import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import { Box } from "@chakra-ui/react";
import { getToken, getUserInfo } from "../logic/auth";
import { useEffect, useState } from "react";
import io from "socket.io-client";
import {
    COMPETITION_WEBSOCKET_URL,
    INCIDENTS_WEBSOCKET_URL,
    WEBSOCKET_PATH,
} from "../logic/request.ts";
import { useAtomValue } from "jotai";
import { showSidebarAtom } from "../logic/atoms.ts";
import { isMobile, isNotificationsSupported } from "../logic/utils.ts";

const Layout = (): JSX.Element => {
    const userInfo = getUserInfo();
    const navigate = useNavigate();
    const showSidebar = useAtomValue(showSidebarAtom);
    const [incidentsSocket] = useState(
        io(INCIDENTS_WEBSOCKET_URL, {
            transports: ["websocket"],
            path: WEBSOCKET_PATH,
            closeOnBeforeunload: true,
            auth: {
                token: getToken(),
            },
        })
    );
    const [competitionSocket] = useState(
        io(COMPETITION_WEBSOCKET_URL, {
            transports: ["websocket"],
            path: WEBSOCKET_PATH,
            closeOnBeforeunload: true,
            auth: {
                token: getToken(),
            },
        })
    );

    useEffect(() => {
        if (!userInfo) return;
        if (isNotificationsSupported()) {
            if (import.meta.env.PROD && isMobile()) {
                navigator.serviceWorker.register("sw.js");
            }
            Notification.requestPermission();
            incidentsSocket.emit("join");
            competitionSocket.emit("join");

            incidentsSocket.on("newIncident", (data) => {
                Notification.requestPermission().then((permission) => {
                    if (permission === "granted") {
                        if (isMobile()) {
                            navigator.serviceWorker.ready.then(
                                (registration) => {
                                    registration.showNotification(
                                        "New incident",
                                        {
                                            body: `Competitor ${data.competitorName}  on station ${data.deviceName}`,
                                        }
                                    );
                                }
                            );
                        } else {
                            new Notification("New incident", {
                                body: `Competitor ${data.competitorName}  on station ${data.deviceName}`,
                            });
                        }
                    }
                });
            });

            competitionSocket.on("groupShouldBeChanged", (data) => {
                Notification.requestPermission().then((permission) => {
                    if (permission === "granted") {
                        if (isMobile()) {
                            navigator.serviceWorker.ready.then(
                                (registration) => {
                                    registration.showNotification(
                                        "Group should be changed",
                                        {
                                            body: data.message,
                                        }
                                    );
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
                incidentsSocket.emit("leave");
                competitionSocket.emit("leave");
            };
        }
    }, [competitionSocket, incidentsSocket, userInfo]);

    useEffect(() => {
        const token = getToken();
        if (!token) {
            navigate("/auth/login");
        }
    }, [navigate]);

    if (!userInfo) {
        return <></>;
    }
    return (
        <Box display="flex">
            {showSidebar && <Sidebar user={userInfo} />}
            <Box width="100%" padding="5" color="white">
                <Outlet />
            </Box>
        </Box>
    );
};

export default Layout;
