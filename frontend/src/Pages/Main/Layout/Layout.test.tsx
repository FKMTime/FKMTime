import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Layout from "./Layout";

vi.mock("@/lib/auth", () => ({
    getUserInfo: () => ({ id: "user-1", username: "invented-delegate" }),
    getToken: () => "token",
    // Stay signed out of the socket: nothing here needs it
    isUserLoggedIn: () => new Promise(() => {}),
}));
vi.mock("@/lib/competition", () => ({
    competitionSettingsQuery: { key: "competition/settings" },
    getCompetitionInfo: () => new Promise(() => {}),
}));
vi.mock("@/lib/events", () => ({ getEvents: () => Promise.resolve() }));
vi.mock("@/lib/incidents", () => ({
    getUnresolvedIncidentsCount: () => new Promise(() => {}),
}));
vi.mock("@/hooks/useCompetitionSocketEvents", () => ({
    useCompetitionSocketEvents: () => {},
}));
vi.mock("@/hooks/useDelegateAccessSocket", () => ({
    useDelegateAccessSocket: () => {},
}));
vi.mock("@/hooks/useRefetchOnReconnect", () => ({
    useRefetchOnReconnect: () => {},
}));
vi.mock("@/socket", () => ({ socket: { connect: vi.fn() } }));

const phoneUserAgent =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";

describe("Layout on a phone", () => {
    const requestPermission = vi.fn(() => Promise.resolve("denied"));

    beforeEach(() => {
        vi.stubEnv("PROD", true);
        vi.spyOn(navigator, "userAgent", "get").mockReturnValue(phoneUserAgent);
        vi.stubGlobal("Notification", { requestPermission });
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        requestPermission.mockClear();
    });

    // Browsers only offer service workers over HTTPS or on localhost, so a
    // panel opened at a plain http:// address has no navigator.serviceWorker
    it("opens over plain HTTP, where there is no service worker", () => {
        expect("serviceWorker" in navigator).toBe(false);

        expect(() =>
            render(
                <MemoryRouter>
                    <Layout />
                </MemoryRouter>
            )
        ).not.toThrow();
        expect(requestPermission).toHaveBeenCalled();
    });

    it("registers the service worker where the browser offers one", () => {
        const register = vi.fn(() => Promise.resolve());
        Object.defineProperty(navigator, "serviceWorker", {
            configurable: true,
            value: { register },
        });
        try {
            render(
                <MemoryRouter>
                    <Layout />
                </MemoryRouter>
            );
            expect(register).toHaveBeenCalledWith("sw.js");
        } finally {
            delete (navigator as { serviceWorker?: unknown }).serviceWorker;
        }
    });
});
