import { useCallback, useEffect, useRef, useState } from "react";

import { useToast } from "./useToast";
import { UNDO_WINDOW_MS, useUndoToast } from "./useUndoToast";

interface DeferredDeleteOptions {
    /** Deletes on the server; resolves to the HTTP status */
    remove: (id: string) => Promise<number>;
    /** Called after a delete went through, e.g. to refetch counts */
    onDeleted?: () => void;
}

/**
 * Delete with Undo instead of "Are you sure?": the item is hidden at once and
 * only deleted on the server when the Undo window closes (or the page is
 * left). Undo just shows it again, so nothing has to be recreated.
 */
export const useDeferredDelete = ({
    remove,
    onDeleted,
}: DeferredDeleteOptions) => {
    const { toast } = useToast();
    const showUndo = useUndoToast();
    const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
    const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
    // Latest callbacks for timers and the unmount flush
    const latest = useRef({ remove, onDeleted });
    latest.current = { remove, onDeleted };

    const unhide = (id: string) =>
        setPendingIds((ids) => {
            const next = new Set(ids);
            next.delete(id);
            return next;
        });

    const commit = useCallback(
        async (id: string) => {
            timers.current.delete(id);
            const status = await latest.current.remove(id);
            if (status === 204 || status === 200) {
                latest.current.onDeleted?.();
            } else {
                toast({
                    title: "Could not delete",
                    description: "Something went wrong, so it was kept.",
                    variant: "destructive",
                });
            }
            unhide(id);
        },
        [toast]
    );

    const deleteLater = (id: string, title: string) => {
        setPendingIds((ids) => new Set(ids).add(id));
        timers.current.set(
            id,
            setTimeout(() => commit(id), UNDO_WINDOW_MS)
        );
        showUndo({
            title,
            onUndo: () => {
                clearTimeout(timers.current.get(id));
                timers.current.delete(id);
                unhide(id);
            },
        });
    };

    // Leaving the page doesn't cancel a delete: run the pending ones now
    useEffect(() => {
        const pending = timers.current;
        return () => {
            pending.forEach((timer, id) => {
                clearTimeout(timer);
                latest.current.remove(id);
            });
            pending.clear();
        };
    }, []);

    return {
        deleteLater,
        isPending: (id: string) => pendingIds.has(id),
    };
};
