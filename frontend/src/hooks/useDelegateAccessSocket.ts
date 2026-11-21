import { useEffect, useRef } from "react";
import type { io } from "socket.io-client";

import { invalidateDelegateGrants, UncoveredGroup } from "@/lib/delegateGrants";
import { isDelegate } from "@/lib/permissions";

type AppSocket = ReturnType<typeof io>;

/**
 * Keeps the panel told about delegate access for a group (SPEC-013): every
 * user hears when their own is given, starts or ends; delegates also hear
 * about everyone's, and what the users do with it.
 *
 * `onChanged` runs when the user's own access changed, so the caller can
 * refetch what that access shows (the incidents and their count).
 * `onNoFreeDelegate` runs for delegates when groups every delegate competes
 * in just became next or started (SPEC-015).
 */
export const useDelegateAccessSocket = (
    socket: AppSocket,
    userId: string | undefined,
    onChanged: () => void,
    onNoFreeDelegate?: (groups: UncoveredGroup[]) => void
) => {
    const onChangedRef = useRef(onChanged);
    const onNoFreeDelegateRef = useRef(onNoFreeDelegate);
    useEffect(() => {
        onChangedRef.current = onChanged;
        onNoFreeDelegateRef.current = onNoFreeDelegate;
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
        const handleNoFreeDelegate = ({
            groups,
        }: {
            groups: UncoveredGroup[];
        }) => {
            void invalidateDelegateGrants();
            onNoFreeDelegateRef.current?.(groups);
        };

        // Emits sent while disconnected are buffered and replayed, which
        // would join twice: wait for the connect handler instead
        if (socket.connected) join();
        socket.on("connect", join);
        socket.on("delegateGrantChanged", handleOwnChanged);
        socket.on("delegateGrantsChanged", handleOthersChanged);
        socket.on("delegateGrantAction", handleOthersChanged);
        socket.on("noFreeDelegate", handleNoFreeDelegate);
        return () => {
            socket.off("connect", join);
            socket.off("delegateGrantChanged", handleOwnChanged);
            socket.off("delegateGrantsChanged", handleOthersChanged);
            socket.off("delegateGrantAction", handleOthersChanged);
            socket.off("noFreeDelegate", handleNoFreeDelegate);
            if (delegate) socket.emit("leaveDelegateGrants");
        };
    }, [socket, userId]);
};
