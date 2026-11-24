import { isMobile } from "./utils";

/**
 * Browsers only offer service workers in a secure context (HTTPS or
 * localhost). A panel opened at a plain http:// address has none
 */
export const hasServiceWorker = () => "serviceWorker" in navigator;

/** Phones show notifications through it; nothing to do without one */
export const registerServiceWorker = () => {
    if (!hasServiceWorker()) return;
    void navigator.serviceWorker.register("sw.js");
};

interface BrowserNotification {
    title: string;
    body: string;
    tag?: string;
    /** Desktop only: a phone's notification opens the panel itself */
    onClick?: () => void;
    /** Phones: skip it if one with the same tag is still shown */
    skipIfShown?: boolean;
}

/**
 * Phones show it through the service worker, other browsers directly. With
 * no service worker on a phone it falls back to a plain notification, which
 * some phone browsers refuse: then nothing is shown
 */
export const showBrowserNotification = ({
    title,
    body,
    tag,
    onClick,
    skipIfShown,
}: BrowserNotification) => {
    if (isMobile() && hasServiceWorker()) {
        void navigator.serviceWorker.ready.then(async (registration) => {
            if (skipIfShown && tag) {
                const shown = await registration.getNotifications({ tag });
                if (shown.length > 0) return;
            }
            await registration.showNotification(title, { body, tag });
        });
        return;
    }
    try {
        const notification = new Notification(title, { body, tag });
        if (onClick) {
            notification.onclick = () => {
                window.focus();
                onClick();
            };
        }
    } catch {
        // Android browsers only show notifications through a service worker
    }
};
