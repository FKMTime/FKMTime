import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearQueryCache } from "@/lib/queryCache";
import { ConfirmProvider } from "@/providers/ConfirmProvider";
import { renderWithQueryClient } from "@/test/queryClient";

import IntegratedLiveConnection from "./IntegratedLiveConnection";

const fetchConnection = vi.hoisted(() => vi.fn());
const startConnect = vi.hoisted(() => vi.fn());
const disconnect = vi.hoisted(() => vi.fn());

vi.mock("@/lib/integratedLive", () => ({
    integratedLiveConnectionQuery: {
        key: "competition/integrated-live/connection",
        fetch: fetchConnection,
    },
    startIntegratedLiveConnect: startConnect,
    disconnectIntegratedLive: disconnect,
}));

const renderCard = () =>
    renderWithQueryClient(
        <ConfirmProvider>
            <IntegratedLiveConnection />
        </ConfirmProvider>
    );

const status = (overrides = {}) => ({
    state: "CONNECTED",
    connectedAs: "Ada Example",
    canEnterScores: true,
    brokenAt: null,
    usesIntegratedLive: true,
    ...overrides,
});

describe("IntegratedLiveConnection", () => {
    beforeEach(() => {
        clearQueryCache();
        fetchConnection.mockReset();
        startConnect.mockReset();
        disconnect.mockReset();
    });

    it("offers to connect when nobody has", async () => {
        fetchConnection.mockResolvedValue(
            status({ state: "NOT_CONNECTED", connectedAs: null })
        );
        renderCard();

        await userEvent.click(
            await screen.findByRole("button", {
                name: "Connect to Integrated Live Results",
            })
        );

        expect(startConnect).toHaveBeenCalled();
    });

    it("says who results are entered as", async () => {
        fetchConnection.mockResolvedValue(status());
        renderCard();

        expect(await screen.findByText("Ada Example")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Reconnect" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Disconnect" })).toBeTruthy();
    });

    it("warns when the account can't enter results", async () => {
        fetchConnection.mockResolvedValue(status({ canEnterScores: false }));
        renderCard();

        expect(
            await screen.findByText(/This account can't enter results/)
        ).toBeTruthy();
    });

    it("asks to reconnect when the connection broke", async () => {
        fetchConnection.mockResolvedValue(
            status({ state: "BROKEN", brokenAt: "2026-11-13T10:00:00Z" })
        );
        renderCard();

        expect(
            await screen.findByText(/Integrated Live Results disconnected/)
        ).toBeTruthy();
    });

    it("disconnects after confirmation", async () => {
        fetchConnection.mockResolvedValue(status());
        disconnect.mockResolvedValue(200);
        renderCard();

        await userEvent.click(
            await screen.findByRole("button", { name: "Disconnect" })
        );
        await userEvent.click(
            within(await screen.findByRole("dialog")).getByRole("button", {
                name: "Disconnect",
            })
        );

        expect(disconnect).toHaveBeenCalled();
    });
});
