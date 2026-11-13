import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Suspense, useCallback, useEffect, useState } from "react";
import { matchPath, Outlet, useNavigate } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import RequestError from "@/Components/shared/RequestError";
import {
    NewIncidentSocketData,
    useCompetitionSocketEvents,
} from "@/hooks/useCompetitionSocketEvents";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useNavItems } from "@/hooks/useNavItems";
import { useRefetchOnReconnect } from "@/hooks/useRefetchOnReconnect";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName } from "@/lib/activities";
import {
    competitionAtom,
    pageHeaderAtom,
    quickEntryAtom,
    unresolvedIncidentsCountAtom,
} from "@/lib/atoms";
import { getToken, getUserInfo, isUserLoggedIn } from "@/lib/auth";
import {
    competitionSettingsQuery,
    getCompetitionInfo,
} from "@/lib/competition";
import { getEvents } from "@/lib/events";
import { getUnresolvedIncidentsCount } from "@/lib/incidents";
import {
    integratedLiveConnectionQuery,
    invalidateIntegratedLiveRounds,
} from "@/lib/integratedLive";
import { Competition } from "@/lib/interfaces";
import {
    getCompetitionDayLabel,
    getDefaultCrumbs,
    getDetailLabel,
    getMobileBackTarget,
    MORE_PATH,
} from "@/lib/navigation";
import { isDelegate, isOrganizerOrDelegate } from "@/lib/permissions";
import { queryClient } from "@/lib/queryClient";
import {
    cn,
    isMobile,
    isNotificationsSupported,
    officialResultsDestinationName,
} from "@/lib/utils";
import { socket } from "@/socket";

import DesktopHeader from "./DesktopHeader";
import DesktopSidebar from "./DesktopSidebar";
import EnterAttemptFab from "./EnterAttemptFab";
import MobileHeader from "./MobileHeader";
import MobileTabBar from "./MobileTabBar";
import QuickEntryHost from "./QuickEntryHost";

const Layout = () => {
    const userInfo = getUserInfo();
    const navigate = useNavigate();
    const [competition, setCompetition] = useAtom(competitionAtom);
    const [unresolvedIncidentsCount, setUnresolvedIncidentsCount] = useAtom(
        unresolvedIncidentsCountAtom
    );
    const [isCompetitionError, setIsCompetitionError] = useState(false);
    const { toast } = useToast();
    useRefetchOnReconnect();

    const fetchUnresolvedIncidentsCount = useCallback(() => {
        getUnresolvedIncidentsCount().then((data) =>
            setUnresolvedIncidentsCount(data.count)
        );
    }, [setUnresolvedIncidentsCount]);

    const applyCompetition = useCallback(
        (response: Awaited<ReturnType<typeof getCompetitionInfo>> | null) => {
            if (response?.status === 404) {
                navigate("/competition/import");
                return;
            }
            // 35 files read this atom: only a real competition goes in
            if (response?.status !== 200) {
                setIsCompetitionError(true);
                return;
            }
            setIsCompetitionError(false);
            setCompetition(response.data);
        },
        [navigate, setCompetition]
    );
    const fetchCompetition = useCallback(
        () =>
            getCompetitionInfo()
                .catch(() => null)
                .then(applyCompetition),
        [applyCompetition]
    );

    const fetchEvents = async () => {
        await getEvents();
    };

    const userKey: string | undefined = userInfo
        ? userInfo.id ?? userInfo.username ?? "signed-in"
        : undefined;

    useEffect(() => {
        if (!userKey || !isNotificationsSupported()) return;
        if (import.meta.env.PROD && isMobile()) {
            navigator.serviceWorker.register("sw.js");
        }
        Notification.requestPermission();
    }, [userKey]);

    useCompetitionSocketEvents(socket, userKey, {
        onIntegratedLiveRoundsChanged: () => {
            void invalidateIntegratedLiveRounds();
        },
        onRoundShouldBeOpened: ({ roundId, blockers }) => {
            void invalidateIntegratedLiveRounds();
            if (!isOrganizerOrDelegate() || !isNotificationsSupported()) {
                return;
            }
            const title = `Open ${activityCodeToName(roundId)} in WCA Integrated Live Results?`;
            const body =
                blockers.length > 0
                    ? blockers.join(". ")
                    : "Its first group started. Open it from Home.";
            Notification.requestPermission().then((permission) => {
                if (permission !== "granted") return;
                if (isMobile()) {
                    navigator.serviceWorker.ready.then((registration) =>
                        registration.showNotification(title, {
                            body,
                            tag: `roundShouldBeOpened-${roundId}`,
                        })
                    );
                } else {
                    const notification = new Notification(title, {
                        body,
                        tag: `roundShouldBeOpened-${roundId}`,
                    });
                    notification.onclick = () => {
                        window.focus();
                        navigate("/");
                    };
                }
            });
        },
        onIntegratedLiveConnectionChanged: () => {
            fetchCompetition();
            void queryClient.invalidateQueries({
                queryKey: [integratedLiveConnectionQuery.key],
            });
            void queryClient.invalidateQueries({
                queryKey: [competitionSettingsQuery.key],
            });
        },
        onScoretakingSoftwareChanged: ({ officialResultsDestination }) => {
            fetchCompetition();
            void queryClient.invalidateQueries({
                queryKey: [competitionSettingsQuery.key],
            });
            toast({
                title: "The WCA website changed where results go",
                description:
                    officialResultsDestination === "NONE"
                        ? "FKMTime doesn't send official results anywhere from now on."
                        : `FKMTime sends official results to ${officialResultsDestinationName(officialResultsDestination)} from now on, starting with every result entered so far.`,
            });
        },
        onNewIncident: (data: NewIncidentSocketData) => {
            fetchUnresolvedIncidentsCount();
            if (!isNotificationsSupported()) return;
            const message = `Competitor ${data.competitorName} on station ${data.deviceName}`;
            Notification.requestPermission().then((permission) => {
                if (permission === "granted") {
                    if (isMobile()) {
                        navigator.serviceWorker.ready.then(
                            async (registration) => {
                                if (
                                    await registration
                                        .getNotifications({
                                            tag: `newIncident-${data.id}`,
                                        })
                                        .then((n) => n.length === 0)
                                ) {
                                    await registration.showNotification(
                                        "New incident",
                                        {
                                            body: message,
                                            tag: `newIncident-${data.id}`,
                                        }
                                    );
                                }
                            }
                        );
                    } else {
                        const notification = new Notification("New incident", {
                            body: message,
                            tag: `newIncident-${data.id}`,
                        });
                        notification.onclick = () => {
                            window.focus();
                            navigate("/incidents");
                        };
                    }
                }
            });
        },
        onGroupShouldBeChanged: (data: { message: string }) => {
            if (!isNotificationsSupported()) return;
            Notification.requestPermission().then((permission) => {
                if (permission === "granted") {
                    if (isMobile()) {
                        navigator.serviceWorker.ready.then(
                            async (registration) => {
                                if (
                                    await registration
                                        .getNotifications({
                                            tag: `groupShouldBeChanged`,
                                        })
                                        .then((n) => n.length === 0)
                                ) {
                                    await registration.showNotification(
                                        "Group should be changed",
                                        {
                                            body: data.message,
                                            tag: "groupShouldBeChanged",
                                        }
                                    );
                                }
                            }
                        );
                    } else {
                        new Notification("Group should be changed", {
                            body: data.message,
                        });
                    }
                }
            });
        },
    });

    useEffect(() => {
        isUserLoggedIn().then((isLoggedIn) => {
            if (isLoggedIn) {
                socket.auth = { token: getToken() };
                socket.connect();
            } else {
                navigate("/auth/login");
                window.location.reload();
            }
        });
    }, [navigate]);

    useEffect(() => {
        getCompetitionInfo()
            .catch(() => null)
            .then(applyCompetition);
    }, [applyCompetition]);

    useEffect(() => {
        fetchEvents();
    }, []);

    useEffect(() => {
        fetchUnresolvedIncidentsCount();
    }, [fetchUnresolvedIncidentsCount]);

    if (!userInfo) return <></>;
    if (!competition) {
        return isCompetitionError ? (
            <div className="p-4 md:p-8">
                <RequestError onRetry={fetchCompetition} />
            </div>
        ) : (
            <></>
        );
    }
    return (
        <AppShell
            competition={competition}
            unresolvedIncidentsCount={unresolvedIncidentsCount}
        />
    );
};

interface AppShellProps {
    competition: Competition;
    unresolvedIncidentsCount: number;
}

const AppShell = ({ competition, unresolvedIncidentsCount }: AppShellProps) => {
    const { items, activeItem, pathname } = useNavItems();
    const pageHeader = useAtomValue(pageHeaderAtom);
    const setQuickEntry = useSetAtom(quickEntryAtom);

    const canAccessSettings = items.some((item) => item.id === "settings");
    const canEnterAttempts = isDelegate() && competition.useFkmTimeDevices;
    const roundMatch = matchPath("/results/round/:id", pathname);
    const showFab =
        canEnterAttempts && (pathname === "/results" || !!roundMatch);

    const isHome = activeItem?.id === "home";
    const crumbs = pageHeader?.crumbs ?? getDefaultCrumbs(pathname, activeItem);
    const mobileTitle =
        pageHeader?.title ??
        (isHome
            ? competition.name
            : pathname === MORE_PATH
              ? "More"
              : getDetailLabel(pathname) ?? activeItem?.label ?? "FKMTime");
    const mobileSubtitle =
        pageHeader?.subtitle ??
        (isHome
            ? getCompetitionDayLabel(
                  competition.wcif.schedule.startDate,
                  competition.wcif.schedule.numberOfDays
              )
            : undefined);
    useDocumentTitle(
        isHome ? null : crumbs[crumbs.length - 1]?.label,
        competition.name
    );
    const backTo =
        pageHeader?.backTo !== undefined
            ? pageHeader.backTo
            : getMobileBackTarget(pathname, items, activeItem);

    const openQuickEntry = () =>
        setQuickEntry({ isOpen: true, roundId: roundMatch?.params.id });

    return (
        <div className="min-h-dvh md:flex">
            <DesktopSidebar
                items={items}
                activeItem={activeItem}
                unresolvedIncidentsCount={unresolvedIncidentsCount}
            />
            <div className="flex min-w-0 flex-1 flex-col">
                <DesktopHeader
                    competitionName={competition.name}
                    // Home's heading is the competition itself
                    crumbs={isHome ? [] : crumbs}
                    canEnterAttempts={canEnterAttempts}
                    canAccessSettings={canAccessSettings}
                    onEnterAttempt={openQuickEntry}
                />
                <MobileHeader
                    title={mobileTitle}
                    subtitle={mobileSubtitle}
                    backTo={backTo}
                    canAccessSettings={canAccessSettings}
                />
                <main
                    className={cn(
                        "flex flex-1 flex-col gap-5 px-4 pb-[calc(max(env(safe-area-inset-bottom),0.375rem)+5.5rem)] pt-4 md:px-8 md:pb-10 md:pt-6",
                        // Room for the Enter attempt button above the tab bar
                        showFab &&
                            "pb-[calc(max(env(safe-area-inset-bottom),0.375rem)+9rem)]"
                    )}
                >
                    <Suspense fallback={<LoadingPage />}>
                        <Outlet />
                    </Suspense>
                </main>
            </div>
            <MobileTabBar
                items={items}
                activeItem={activeItem}
                pathname={pathname}
                unresolvedIncidentsCount={unresolvedIncidentsCount}
            />
            {showFab && <EnterAttemptFab onClick={openQuickEntry} />}
            <QuickEntryHost />
        </div>
    );
};

export default Layout;
