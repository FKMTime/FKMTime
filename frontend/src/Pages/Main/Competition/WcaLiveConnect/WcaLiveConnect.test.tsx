import { render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WcaLiveConnect from "./WcaLiveConnect";

const connect = vi.hoisted(() => vi.fn());

vi.mock("@/lib/integratedLive", () => ({
    connectIntegratedLive: connect,
    integratedLiveConnectionQuery: {
        key: "competition/integrated-live/connection",
    },
}));

const renderAt = (path: string) =>
    render(
        <StrictMode>
            <MemoryRouter initialEntries={[path]}>
                <Routes>
                    <Route
                        path="/competition/wca-live-connect"
                        element={<WcaLiveConnect />}
                    />
                    <Route path="/competition" element={<p>Settings</p>} />
                </Routes>
            </MemoryRouter>
        </StrictMode>
    );

const STATE_KEY = "fkmtime-oauth-state-integrated-live";

describe("WcaLiveConnect", () => {
    beforeEach(() => {
        connect.mockReset();
        sessionStorage.clear();
        // This tab started the connection
        sessionStorage.setItem(STATE_KEY, "state-1");
    });

    it("sends the code once, even when effects run twice, then goes to settings", async () => {
        connect.mockResolvedValue({
            status: 200,
            data: { state: "CONNECTED", connectedAs: "Ada Example" },
        });
        renderAt("/competition/wca-live-connect?code=code-1&state=state-1");

        expect(await screen.findByText("Settings")).toBeTruthy();
        expect(connect).toHaveBeenCalledTimes(1);
        expect(connect).toHaveBeenCalledWith("code-1");
    });

    it("explains a refused connection and links back to settings", async () => {
        connect.mockResolvedValue({
            status: 400,
            data: { message: "The WCA did not accept the sign-in" },
        });
        renderAt("/competition/wca-live-connect?code=used-code&state=state-1");

        await waitFor(() =>
            expect(
                screen.getByText(/The WCA did not accept the sign-in/)
            ).toBeTruthy()
        );
        expect(
            screen.getByRole("link", { name: "Back to settings" })
        ).toBeTruthy();
    });

    it("refuses a code from a sign-in this tab did not start", async () => {
        sessionStorage.clear();
        renderAt("/competition/wca-live-connect?code=planted-code");

        expect(
            await screen.findByText(/wasn't started from this browser tab/)
        ).toBeTruthy();
        expect(connect).not.toHaveBeenCalled();
    });

    it("refuses a code whose state does not match", async () => {
        renderAt("/competition/wca-live-connect?code=planted-code&state=other");

        expect(
            await screen.findByText(/wasn't started from this browser tab/)
        ).toBeTruthy();
        expect(connect).not.toHaveBeenCalled();
        expect(sessionStorage.getItem(STATE_KEY)).toBeNull();
    });

    it("says so when the WCA sent no code", () => {
        renderAt("/competition/wca-live-connect");

        expect(screen.getByText(/didn't send a sign-in code/)).toBeTruthy();
        expect(connect).not.toHaveBeenCalled();
    });
});
