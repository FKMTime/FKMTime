import { useEffect, useRef } from "react";

import { socket } from "@/socket";

/**
 * Listens for server events while mounted, for rooms a layout already
 * keeps joined. Handlers can change between renders without resubscribing.
 */
export const useSocketEvents = (handlers: Record<string, () => void>) => {
    const latest = useRef(handlers);
    useEffect(() => {
        latest.current = handlers;
    });
    const eventsJson = JSON.stringify(Object.keys(handlers).sort());

    useEffect(() => {
        const listeners = (JSON.parse(eventsJson) as string[]).map((event) => ({
            event,
            listener: () => latest.current[event]?.(),
        }));
        listeners.forEach(({ event, listener }) => socket.on(event, listener));
        return () =>
            listeners.forEach(({ event, listener }) =>
                socket.off(event, listener)
            );
    }, [eventsJson]);
};
