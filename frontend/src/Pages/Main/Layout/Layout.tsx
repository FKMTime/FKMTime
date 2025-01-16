import { useAtom } from "jotai";
import { Suspense, useCallback, useContext, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import ModeToggle from "@/Components/ModeToggle";
import { SidebarProvider, SidebarTrigger } from "@/Components/ui/sidebar";
import { competitionAtom } from "@/lib/atoms";
import { getToken, getUserInfo, isUserLoggedIn } from "@/lib/auth";
import { getCompetitionInfo } from "@/lib/competition";
import { getEvents } from "@/lib/events";
import { isMobile, isNotificationsSupported } from "@/lib/utils";
import { socket, SocketContext } from "@/socket";

import AppSidebar from "./AppSidebar";
import ProfileDropdown from "./ProfileDropdown";

const Layout = () => {
    const userInfo = getUserInfo();
    const navigate = useNavigate();
    const [competition, setCompetition] = useAtom(competitionAtom);

    const [isConnected, setConnected] = useContext(SocketContext) as [
        number,
        React.Dispatch<React.SetStateAction<number>>,
    ];

    useEffect(() => {
        if (!userInfo) return;
        if (isNotificationsSupported()) {
            if (import.meta.env.PROD && isMobile()) {
                navigator.serviceWorker.register("sw.js");
            }
            Notification.requestPermission();

            socket.emit("joinIncidents");
            socket.emit("joinCompetition");
            socket.on("newIncident", (data) => {
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

            socket.on("groupShouldBeChanged", (data) => {
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
    }, [navigate, userInfo, isConnected]);

    useEffect(() => {
        isUserLoggedIn().then((isLoggedIn) => {
            if (isLoggedIn) {
                socket.auth = { token: getToken() };
                socket.connect();

                socket.on("connect", () => {
                    setConnected(isConnected + 1);
                });
                socket.on("disconnect", () => {
                    //setConnected(false);
                });
            } else {
                navigate("/auth/login");
                window.location.reload();
            }
        });
    }, [navigate, isConnected, setConnected]);

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
        fetchCompetition();
    }, [fetchCompetition]);

    useEffect(() => {
        fetchEvents();
    }, []);

    if (!userInfo || !competition) {
        return <></>;
    }
    return (
        <SidebarProvider>
            <AppSidebar />
            <main className="w-full p-5 h-screen overflow-y-auto flex flex-col gap-5">
                <div className="flex justify-between">
                    <SidebarTrigger />
                    <div className="flex items-center gap-5">
                        <ModeToggle />
                        <ProfileDropdown />
                    </div>
                </div>
                <Suspense fallback={<LoadingPage />}>
                    <Outlet />
                </Suspense>
            </main>
        </SidebarProvider>
    );
};

export default Layout;
