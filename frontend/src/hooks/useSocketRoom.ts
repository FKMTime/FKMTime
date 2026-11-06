import { QueryKey, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { socket } from "@/socket";

interface SocketRoomOptions {
    /** Sent with the join and leave events, e.g. `{ roundId }` */
    params?: Record<string, string>;
    /** Server events, and the query each one makes out of date */
    invalidateOn?: Record<string, QueryKey>;
}

/**
 * Keeps the page in a socket.io room while it's mounted. `room` names the
 * `join…` and `leave…` events (`"Results"` sends `joinResults`); null joins
 * nothing. The room is joined again on every reconnect, because a new
 * connection starts outside it, and its listeners always come off on unmount.
 */
export const useSocketRoom = (
    room: string | null,
    { params, invalidateOn = {} }: SocketRoomOptions = {}
) => {
    const queryClient = useQueryClient();
    // Compared by value, so callers can pass object literals
    const paramsJson = JSON.stringify(params ?? null);
    const invalidateOnJson = JSON.stringify(invalidateOn);

    useEffect(() => {
        if (!room) return;
        const roomParams = JSON.parse(paramsJson) ?? undefined;
        const invalidations = Object.entries(
            JSON.parse(invalidateOnJson) as Record<string, QueryKey>
        ).map(([event, queryKey]) => ({
            event,
            handler: () => void queryClient.invalidateQueries({ queryKey }),
        }));

        // A room without params is joined with no payload, as before
        const join = () =>
            roomParams === undefined
                ? socket.emit(`join${room}`)
                : socket.emit(`join${room}`, roomParams);
        // Emits sent while disconnected are buffered and replayed, which
        // would join twice: wait for the connect handler instead
        if (socket.connected) join();
        socket.on("connect", join);
        invalidations.forEach(({ event, handler }) =>
            socket.on(event, handler)
        );
        return () => {
            socket.off("connect", join);
            invalidations.forEach(({ event, handler }) =>
                socket.off(event, handler)
            );
            if (roomParams === undefined) socket.emit(`leave${room}`);
            else socket.emit(`leave${room}`, roomParams);
        };
    }, [room, paramsJson, invalidateOnJson, queryClient]);
};
