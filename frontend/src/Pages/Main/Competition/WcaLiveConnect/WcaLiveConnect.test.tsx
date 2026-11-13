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

describe("WcaLiveConnect", () => {
    beforeEach(() => connect.mockReset());

    it("sends the code once, even when effects run twice, then goes to settings", async () => {
        connect.mockResolvedValue({
            status: 200,
            data: { state: "CONNECTED", connectedAs: "Ada Example" },
        });
        renderAt("/competition/wca-live-connect?code=code-1");

        expect(await screen.findByText("Settings")).toBeTruthy();
        expect(connect).toHaveBeenCalledTimes(1);
        expect(connect).toHaveBeenCalledWith("code-1");
    });

    it("explains a refused connection and links back to settings", async () => {
        connect.mockResolvedValue({
            status: 400,
            data: { message: "The WCA did not accept the sign-in" },
        });
        renderAt("/competition/wca-live-connect?code=used-code");

        await waitFor(() =>
            expect(
                screen.getByText(/The WCA did not accept the sign-in/)
            ).toBeTruthy()
        );
        expect(
            screen.getByRole("link", { name: "Back to settings" })
        ).toBeTruthy();
    });

    it("says so when the WCA sent no code", () => {
        renderAt("/competition/wca-live-connect");

        expect(screen.getByText(/didn't send a sign-in code/)).toBeTruthy();
        expect(connect).not.toHaveBeenCalled();
    });
});
