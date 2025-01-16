import { createContext } from "react";
import { io } from "socket.io-client";

import { WEBSOCKET_PATH, WEBSOCKET_URL } from "./lib/request";

export const SocketContext = createContext(
    undefined as
        | [number, React.Dispatch<React.SetStateAction<number>>]
        | undefined
);

export const socket = io(WEBSOCKET_URL, {
    transports: ["websocket"],
    path: WEBSOCKET_PATH,
    closeOnBeforeunload: true,
    autoConnect: false,
    reconnectionDelayMax: 30000,
});
