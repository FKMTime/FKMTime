import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearQueryCache } from "@/lib/queryCache";
import { renderWithQueryClient } from "@/test/queryClient";

import IntegratedLiveRoundsToOpen from "./IntegratedLiveRoundsToOpen";

const fetchRounds = vi.hoisted(() => vi.fn());
const fetchBlockers = vi.hoisted(() => vi.fn());
const openRound = vi.hoisted(() => vi.fn());

vi.mock("@/lib/integratedLive", () => ({
    integratedLiveRoundsQuery: {
        key: "competition/integrated-live/rounds",
        fetch: fetchRounds,
    },
    integratedLiveBlockersQuery: (roundId: string) => ({
        key: `competition/integrated-live/rounds/${roundId}/blockers`,
        fetch: fetchBlockers,
    }),
    openIntegratedLiveRound: openRound,
    invalidateIntegratedLiveRounds: vi.fn(),
}));
vi.mock("@/lib/activities", () => ({
    activityCodeToName: (id: string) => id,
}));

describe("IntegratedLiveRoundsToOpen", () => {
    beforeEach(() => {
        clearQueryCache();
        fetchRounds.mockReset();
        fetchBlockers.mockReset();
        openRound.mockReset();
    });

    it("offers to open a later round, with what argues against it", async () => {
        fetchRounds.mockResolvedValue([{ roundId: "333-r2", state: "ready" }]);
        fetchBlockers.mockResolvedValue([
            "2 results of 333-r1 waiting for an extra",
        ]);
        openRound.mockResolvedValue({ ok: true, message: "333-r2 opened" });
        renderWithQueryClient(
            <IntegratedLiveRoundsToOpen roundIds={["333-r2"]} />
        );

        expect(
            await screen.findByText("2 results of 333-r1 waiting for an extra")
        ).toBeTruthy();
        expect(screen.getByText(/Opening it locks 333-r1/)).toBeTruthy();
        await userEvent.click(
            screen.getByRole("button", { name: "Open anyway" })
        );

        expect(openRound).toHaveBeenCalledWith("333-r2");
    });

    it("explains a round the WCA keeps pending, without an open button", async () => {
        fetchRounds.mockResolvedValue([
            { roundId: "333-r2", state: "pending" },
        ]);
        renderWithQueryClient(
            <IntegratedLiveRoundsToOpen roundIds={["333-r2"]} />
        );

        expect(
            await screen.findByText(/waiting for the previous round/)
        ).toBeTruthy();
        expect(screen.queryByRole("button")).toBeNull();
    });

    it("shows nothing for open rounds or rounds not running", async () => {
        fetchRounds.mockResolvedValue([
            { roundId: "333-r1", state: "open" },
            { roundId: "222-r1", state: "ready" },
        ]);
        const { container } = renderWithQueryClient(
            <IntegratedLiveRoundsToOpen roundIds={["333-r1"]} />
        );

        await vi.waitFor(() => expect(fetchRounds).toHaveBeenCalled());
        expect(container.textContent).toBe("");
    });
});
