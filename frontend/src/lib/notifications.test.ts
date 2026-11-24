import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    registerServiceWorker,
    showBrowserNotification,
} from "./notifications";

const phoneUserAgent =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";

const setServiceWorker = (value: unknown) =>
    Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value,
    });

const notice = { title: "New incident", body: "Station 3", tag: "t-1" };

describe("browser notifications", () => {
    const NotificationMock = vi.fn();

    beforeEach(() => {
        vi.stubGlobal("Notification", NotificationMock);
    });

    afterEach(() => {
        delete (navigator as { serviceWorker?: unknown }).serviceWorker;
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        NotificationMock.mockReset();
    });

    describe("on a phone", () => {
        beforeEach(() => {
            vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
                phoneUserAgent
            );
        });

        it("shows it through the service worker", async () => {
            const showNotification = vi.fn(() => Promise.resolve());
            const ready = Promise.resolve({
                showNotification,
                getNotifications: () => Promise.resolve([]),
            });
            setServiceWorker({ ready });
            showBrowserNotification(notice);
            await ready;
            await vi.waitFor(() =>
                expect(showNotification).toHaveBeenCalledWith("New incident", {
                    body: "Station 3",
                    tag: "t-1",
                })
            );
            expect(NotificationMock).not.toHaveBeenCalled();
        });

        it("skips one still shown, when asked to", async () => {
            const showNotification = vi.fn(() => Promise.resolve());
            const getNotifications = vi.fn(() => Promise.resolve([{}]));
            setServiceWorker({
                ready: Promise.resolve({ showNotification, getNotifications }),
            });
            showBrowserNotification({ ...notice, skipIfShown: true });
            await vi.waitFor(() =>
                expect(getNotifications).toHaveBeenCalledWith({ tag: "t-1" })
            );
            expect(showNotification).not.toHaveBeenCalled();
        });

        // Over plain HTTP the browser has no service worker
        it("falls back to a plain notification without a service worker", () => {
            showBrowserNotification(notice);
            expect(NotificationMock).toHaveBeenCalledWith("New incident", {
                body: "Station 3",
                tag: "t-1",
            });
        });

        it("shows nothing when the browser refuses a plain one", () => {
            NotificationMock.mockImplementation(() => {
                throw new TypeError("Illegal constructor");
            });
            expect(() => showBrowserNotification(notice)).not.toThrow();
        });

        it("doesn't register a service worker the browser doesn't offer", () => {
            expect(() => registerServiceWorker()).not.toThrow();
        });
    });

    it("shows a plain notification on a desktop, opening the page on click", () => {
        const focus = vi.spyOn(window, "focus").mockImplementation(() => {});
        const notification: { onclick?: () => void } = {};
        NotificationMock.mockImplementation(function () {
            return notification;
        });
        const onClick = vi.fn();
        showBrowserNotification({ ...notice, onClick });
        notification.onclick?.();
        expect(focus).toHaveBeenCalled();
        expect(onClick).toHaveBeenCalled();
    });
});
