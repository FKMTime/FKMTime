import { useEffect, useState } from "react";

import { socket } from "@/socket";

/** Grace period before a socket that never connected counts as down */
const FIRST_CONNECT_GRACE_MS = 3000;

/**
 * Whether the live connection is down. False while connected, and during a
 * short grace period on page load so the first connect doesn't flash it.
 */
export const useIsSocketDown = () => {
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [isPastGrace, setIsPastGrace] = useState(socket.connected);

    useEffect(() => {
        const handleConnect = () => {
            setIsConnected(true);
            setIsPastGrace(true);
        };
        const handleDisconnect = () => setIsConnected(false);
        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);
        const timeout = setTimeout(
            () => setIsPastGrace(true),
            FIRST_CONNECT_GRACE_MS
        );
        return () => {
            socket.off("connect", handleConnect);
            socket.off("disconnect", handleDisconnect);
            clearTimeout(timeout);
        };
    }, []);

    return !isConnected && isPastGrace;
};
