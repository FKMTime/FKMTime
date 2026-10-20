import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Suspense, useCallback, useContext, useEffect } from "react";
import { matchPath, Outlet, useNavigate } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import { useNavItems } from "@/hooks/useNavItems";
import {
    competitionAtom,
    pageHeaderAtom,
    quickEntryAtom,
    unresolvedIncidentsCountAtom,
} from "@/lib/atoms";
import { getToken, getUserInfo, isUserLoggedIn } from "@/lib/auth";
import { getCompetitionInfo } from "@/lib/competition";
import { getEvents } from "@/lib/events";
import { getUnresolvedIncidentsCount } from "@/lib/incidents";
import { Competition } from "@/lib/interfaces";
import {
    getCompetitionDayLabel,
    getDefaultCrumbs,
    getDetailLabel,
    getMobileBackTarget,
    MORE_PATH,
} from "@/lib/navigation";
import { isDelegate } from "@/lib/permissions";
import { cn, isMobile, isNotificationsSupported } from "@/lib/utils";
import { socket, SocketContext } from "@/socket";

import DesktopHeader from "./DesktopHeader";
import DesktopSidebar from "./DesktopSidebar";
import EnterAttemptFab from "./EnterAttemptFab";
import MobileHeader from "./MobileHeader";
import MobileTabBar from "./MobileTabBar";
import QuickEntryHost from "./QuickEntryHost";

interface NewIncidentSocketData {
    id: string;
    competitorName: string;
    deviceName: string;
}

const Layout = () => {
    const userInfo = getUserInfo();
    const navigate = useNavigate();
    const [competition, setCompetition] = useAtom(competitionAtom);
    const [unresolvedIncidentsCount, setUnresolvedIncidentsCount] = useAtom(
        unresolvedIncidentsCountAtom
    );

    const [isConnected, setConnected] = useContext(SocketContext) as [
        number,
        React.Dispatch<React.SetStateAction<number>>,
    ];

    const fetchUnresolvedIncidentsCount = useCallback(() => {
        getUnresolvedIncidentsCount().then((data) =>
            setUnresolvedIncidentsCount(data.count)
        );
    }, [setUnresolvedIncidentsCount]);

    const fetchCompetition = useCallback(async () => {
        const response = await getCompetitionInfo();
        if (response.status === 404) {
            navigate("/competition/import");
        }
        setCompetition(response.data);
    }, [navigate, setCompetition]);

    const fetchEvents = async () => {
        await getEvents();
    };

    useEffect(() => {
        if (!userInfo) return;
        if (isNotificationsSupported()) {
            if (import.meta.env.PROD && isMobile()) {
                navigator.serviceWorker.register("sw.js");
            }
            Notification.requestPermission();

            socket.emit("joinIncidents");
            socket.emit("joinCompetition");
            socket.on("newIncident", (data: NewIncidentSocketData) => {
                fetchUnresolvedIncidentsCount();
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
                            const notification = new Notification(
                                "New incident",
                                {
                                    body: message,
                                    tag: `newIncident-${data.id}`,
                                }
                            );
                            notification.onclick = () => {
                                window.focus();
                                navigate("/incidents");
                            };
                        }
                    }
                });
            });

            socket.on("groupShouldBeChanged", (data: { message: string }) => {
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
            });

            return () => {
                socket.emit("leaveIncidents");
                socket.emit("leaveCompetition");
            };
        }
    }, [navigate, userInfo, isConnected, fetchUnresolvedIncidentsCount]);

    useEffect(() => {
        // Each (re)connect bumps the counter, so pages refetch what they missed
        const handleConnect = () => setConnected((count) => count + 1);
        socket.on("connect", handleConnect);
        isUserLoggedIn().then((isLoggedIn) => {
            if (isLoggedIn) {
                socket.auth = { token: getToken() };
                socket.connect();
            } else {
                navigate("/auth/login");
                window.location.reload();
            }
        });
        return () => {
            socket.off("connect", handleConnect);
        };
    }, [navigate, setConnected]);

    useEffect(() => {
        fetchCompetition();
    }, [fetchCompetition]);

    useEffect(() => {
        fetchEvents();
    }, []);

    useEffect(() => {
        fetchUnresolvedIncidentsCount();
    }, [fetchUnresolvedIncidentsCount]);

    if (!userInfo || !competition) {
        return <></>;
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
    const backTo =
        pageHeader?.backTo !== undefined
            ? pageHeader.backTo
            : getMobileBackTarget(pathname, activeItem);

    const openQuickEntry = () =>
        setQuickEntry({ isOpen: true, roundId: roundMatch?.params.id });

    return (
        <div className="min-h-dvh md:flex">
            <DesktopSidebar
                competitionName={competition.name}
                items={items}
                activeItem={activeItem}
                unresolvedIncidentsCount={unresolvedIncidentsCount}
            />
            <div className="flex min-w-0 flex-1 flex-col">
                <DesktopHeader
                    crumbs={crumbs}
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
