import { useEffect } from "react";

/**
 * Keeps the screen from dimming or sleeping while the calling page is
 * mounted, for unattended displays like the venue TV view. The browser
 * drops the lock whenever the tab is hidden, so it's requested again on
 * return. Does nothing where the Screen Wake Lock API is missing (or the
 * page isn't served over HTTPS); the screen then follows the OS settings.
 */
export const useWakeLock = () => {
    useEffect(() => {
        if (!("wakeLock" in navigator)) return;

        let sentinel: WakeLockSentinel | null = null;
        let isActive = true;

        const request = async () => {
            if (document.visibilityState !== "visible") return;
            try {
                const lock = await navigator.wakeLock.request("screen");
                if (isActive) sentinel = lock;
                else lock.release();
            } catch {
                // Refused, e.g. by battery saver; the screen may still sleep
            }
        };

        request();
        document.addEventListener("visibilitychange", request);
        return () => {
            isActive = false;
            document.removeEventListener("visibilitychange", request);
            sentinel?.release();
        };
    }, []);
};
