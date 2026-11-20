import { io } from "socket.io-client";

import { getToken } from "./lib/auth";
import { WEBSOCKET_PATH, WEBSOCKET_URL } from "./lib/request";

export const socket = io(WEBSOCKET_URL, {
    transports: ["websocket"],
    path: WEBSOCKET_PATH,
    closeOnBeforeunload: true,
    autoConnect: false,
    reconnectionDelayMax: 30000,
});

// The server ends a connection when the user's access changes (roles,
// password, expiry). socket.io doesn't reconnect after that on its own, so
// reconnect here: rooms are joined again under the current access.
socket.on("disconnect", (reason: string) => {
    if (reason !== "io server disconnect") return;
    // A signed-in panel reconnects with the token it holds now, which a
    // password change replaces
    if (socket.auth && "token" in socket.auth) {
        socket.auth = { token: getToken() };
    }
    socket.connect();
});
