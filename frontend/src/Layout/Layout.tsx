import { Box } from "@chakra-ui/react";
import { useAtom } from "jotai";
import { Suspense, useCallback, useContext, useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import { competitionAtom } from "@/logic/atoms";
import { getToken, getUserInfo, isUserLoggedIn } from "@/logic/auth";
import { getCompetitionInfo } from "@/logic/competition";
import { getEvents } from "@/logic/events";
import { INotification } from "@/logic/interfaces";
import { isMobile, isNotificationsSupported } from "@/logic/utils";
import { socket, SocketContext } from "@/socket";

import NotificationsModal from "./NotiifcationsModal";
import Sidebar from "./Sidebar";

const Layout = () => {
    const userInfo = getUserInfo();
    const navigate = useNavigate();
    const [competition, setCompetition] = useAtom(competitionAtom);
    const [notifications, setNotifications] = useState<INotification[]>([]);
    const [isOpenNotificationsModal, setIsOpenNotificationsModal] =
        useState<boolean>(false);

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
                if (!notifications.some((n) => n.message === data.message)) {
                    setNotifications((prev) => [
                        {
                            id: data.id,
                            message,
                            type: "incident",
                        },
                        ...prev.filter((n) => n.message !== data.message),
                    ]);
                }
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
                if (!notifications.some((n) => n.message === data.message)) {
                    setNotifications((prev) => [
                        {
                            id: "groupShouldBeChanged",
                            message: data.message,
                            type: "info",
                        },
                        ...prev,
                    ]);
                }

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
    }, [navigate, userInfo, isConnected, notifications]);

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
        <Box display="flex">
            <Sidebar
                user={userInfo}
                competition={competition}
                notifications={notifications}
                onClickNotifications={() => setIsOpenNotificationsModal(true)}
            />
            <Box
                width="100%"
                padding="5"
                color="white"
                height="100vh"
                overflowY="auto"
            >
                <Suspense fallback={<LoadingPage />}>
                    <Outlet />
                </Suspense>
                <NotificationsModal
                    isOpen={isOpenNotificationsModal}
                    onDelete={(id) =>
                        setNotifications((prev) =>
                            prev.filter(
                                (notification) => notification.id !== id
                            )
                        )
                    }
                    onClose={() => setIsOpenNotificationsModal(false)}
                    notifications={notifications}
                />
            </Box>
        </Box>
    );
};

export default Layout;
