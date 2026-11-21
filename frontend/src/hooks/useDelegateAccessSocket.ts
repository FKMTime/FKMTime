import { useEffect, useRef } from "react";
import type { io } from "socket.io-client";

import { invalidateDelegateGrants } from "@/lib/delegateGrants";
import { isDelegate } from "@/lib/permissions";

type AppSocket = ReturnType<typeof io>;

/**
 * Keeps the panel told about delegate access for a group (SPEC-013): every
 * user hears when their own is given, starts or ends; delegates also hear
 * about everyone's, and what the users do with it.
 *
 * `onChanged` runs when the user's own access changed, so the caller can
 * refetch what that access shows (the incidents and their count).
 */
export const useDelegateAccessSocket = (
    socket: AppSocket,
    userId: string | undefined,
    onChanged: () => void
) => {
    const onChangedRef = useRef(onChanged);
    useEffect(() => {
        onChangedRef.current = onChanged;
    });

    useEffect(() => {
        if (!userId) return;
        const delegate = isDelegate();
        const join = () => {
            socket.emit("joinDelegateAccess");
            if (delegate) socket.emit("joinDelegateGrants");
        };
        const handleOwnChanged = () => {
            void invalidateDelegateGrants();
            // Access that only now exists lets this user into the room
            socket.emit("joinIncidents");
            onChangedRef.current();
        };
        const handleOthersChanged = () => void invalidateDelegateGrants();

        // Emits sent while disconnected are buffered and replayed, which
        // would join twice: wait for the connect handler instead
        if (socket.connected) join();
        socket.on("connect", join);
        socket.on("delegateGrantChanged", handleOwnChanged);
        socket.on("delegateGrantsChanged", handleOthersChanged);
        socket.on("delegateGrantAction", handleOthersChanged);
        return () => {
            socket.off("connect", join);
            socket.off("delegateGrantChanged", handleOwnChanged);
            socket.off("delegateGrantsChanged", handleOthersChanged);
            socket.off("delegateGrantAction", handleOthersChanged);
            if (delegate) socket.emit("leaveDelegateGrants");
        };
    }, [socket, userId]);
};
