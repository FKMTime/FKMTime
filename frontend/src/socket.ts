import { io } from "socket.io-client";

import { WEBSOCKET_PATH, WEBSOCKET_URL } from "./logic/request";

export const socket = io(WEBSOCKET_URL, {
    transports: ["websocket"],
    path: WEBSOCKET_PATH,
    closeOnBeforeunload: true,
    autoConnect: false,
});
