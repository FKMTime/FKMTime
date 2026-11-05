import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { socket } from "@/socket";

/**
 * Refetches everything on screen after the socket reconnects, since events
 * sent while it was down are lost. Mounted once, by the layouts.
 */
export const useRefetchOnReconnect = () => {
    const queryClient = useQueryClient();
    useEffect(() => {
        const refetch = () => void queryClient.invalidateQueries();
        socket.io.on("reconnect", refetch);
        return () => {
            socket.io.off("reconnect", refetch);
        };
    }, [queryClient]);
};
