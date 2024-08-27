import { Box } from "@chakra-ui/react";
import { useAtom } from "jotai";
import { useCallback, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";

import { competitionAtom } from "@/logic/atoms";
import { getToken, getUserInfo, isUserLoggedIn } from "@/logic/auth";
import { getCompetitionInfo } from "@/logic/competition";
import { getEvents } from "@/logic/events";
import { isMobile, isNotificationsSupported } from "@/logic/utils";
import { socket } from "@/socket";

import Sidebar from "./Sidebar";

const Layout = () => {
    const userInfo = getUserInfo();
    const navigate = useNavigate();
    const [competition, setCompetition] = useAtom(competitionAtom);

    useEffect(() => {
        if (!userInfo) return;
        if (isNotificationsSupported()) {
            if (import.meta.env.PROD && isMobile()) {
                navigator.serviceWorker.register("sw.js");
            }
            Notification.requestPermission();

            socket.emit("joinIncidents");
            socket.emit("joinCompetition");
            socket.on("connect", () => {
                socket.emit("joinIncidents");
                socket.emit("joinCompetition");
            });
            socket.on("newIncident", (data) => {
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
                                            .then(
                                                (notifications) =>
                                                    notifications.length === 0
                                            )
                                    ) {
                                        await registration.showNotification(
                                            "New incident",
                                            {
                                                body: `Competitor ${data.competitorName}  on station ${data.deviceName}`,
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
                                    body: `Competitor ${data.competitorName}  on station ${data.deviceName}`,
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
                                            .then(
                                                (notifications) =>
                                                    notifications.length === 0
                                            )
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
                if (socket.connected) socket.removeListener("connect");
                socket.emit("leaveIncidents");
                socket.emit("leaveCompetition");
            };
        }
    }, [navigate, userInfo]);

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
            <Sidebar user={userInfo} competition={competition} />
            <Box width="100%" padding="5" color="white">
                <Outlet />
            </Box>
        </Box>
    );
};

export default Layout;
