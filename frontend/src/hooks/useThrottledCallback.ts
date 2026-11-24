import { useCallback, useEffect, useRef } from "react";

/**
 * A stable function that runs `callback` straight away, then at most once
 * every `interval` ms: calls in between are merged into one run at the end
 * of the interval, so the last call is never lost. Nothing runs once the
 * component is gone.
 */
export const useThrottledCallback = (
    callback: () => void,
    interval: number
) => {
    const latest = useRef(callback);
    useEffect(() => {
        latest.current = callback;
    });
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isPending = useRef(false);

    useEffect(
        () => () => {
            if (timer.current) clearTimeout(timer.current);
            timer.current = null;
            isPending.current = false;
        },
        []
    );

    return useCallback(() => {
        if (timer.current) {
            isPending.current = true;
            return;
        }
        latest.current();
        const endInterval = () => {
            if (!isPending.current) {
                timer.current = null;
                return;
            }
            isPending.current = false;
            latest.current();
            timer.current = setTimeout(endInterval, interval);
        };
        timer.current = setTimeout(endInterval, interval);
    }, [interval]);
};
