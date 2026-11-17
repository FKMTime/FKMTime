import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider } from "jotai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { competitionAtom } from "@/lib/atoms";
import { Competition } from "@/lib/interfaces";
import { clearQueryCache } from "@/lib/queryCache";
import { renderWithQueryClient } from "@/test/queryClient";

import RoundsToOpenDialog from "./RoundsToOpenDialog";

const fetchRounds = vi.hoisted(() => vi.fn());
const updateSettings = vi.hoisted(() => vi.fn());
const listeners = vi.hoisted(
    () => new Map<string, (data: { roundId: string }) => void>()
);

vi.mock("@/socket", () => ({
    socket: {
        on: (event: string, handler: (data: { roundId: string }) => void) =>
            listeners.set(event, handler),
        off: (event: string) => listeners.delete(event),
    },
}));
vi.mock("@/lib/integratedLive", () => ({
    integratedLiveRoundsQuery: {
        key: "competition/integrated-live/rounds",
        fetch: fetchRounds,
    },
    integratedLiveBlockersQuery: (roundId: string) => ({
        key: `competition/integrated-live/rounds/${roundId}/blockers`,
        fetch: async () => [],
    }),
    openIntegratedLiveRound: vi.fn(),
    invalidateIntegratedLiveRounds: vi.fn(),
}));
const fetchSettings = vi.hoisted(() => vi.fn());
vi.mock("@/lib/competition", () => ({
    competitionSettingsQuery: {
        key: "competition/settings",
        fetch: fetchSettings,
    },
    updateCompetitionSettings: updateSettings,
}));
vi.mock("@/lib/activities", () => ({
    activityCodeToName: (id: string) => id,
}));

const renderDialog = (
    competition: Partial<Competition>,
    roundIds: string[]
) => {
    const store = createStore();
    store.set(competitionAtom, { id: "c1", ...competition } as Competition);
    renderWithQueryClient(
        <Provider store={store}>
            <RoundsToOpenDialog roundIds={roundIds} onClose={vi.fn()} />
        </Provider>
    );
    return store;
};

describe("RoundsToOpenDialog", () => {
    beforeEach(() => {
        clearQueryCache();
        fetchRounds.mockReset();
        updateSettings.mockReset();
        fetchSettings.mockReset();
        listeners.clear();
    });

    it("reminds to open the started rounds in WCA Live", () => {
        renderDialog({ officialResultsDestination: "WCA_LIVE" }, ["333-r1"]);

        expect(
            screen.getByRole("dialog", {
                name: "Open these rounds in WCA Live",
            }).textContent
        ).toContain("333-r1");
    });

    it("shows nothing when official results go nowhere", () => {
        renderDialog({ officialResultsDestination: "NONE" }, ["333-r1"]);

        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("offers the rounds FKMTime didn't open, and automatic opening", async () => {
        fetchRounds.mockResolvedValue([
            { roundId: "333-r2", state: "ready" },
            { roundId: "222-r1", state: "open" },
        ]);
        updateSettings.mockResolvedValue(200);
        fetchSettings.mockResolvedValue({
            scoretakingToken: "kept",
            openRoundsAutomatically: false,
        });
        renderDialog(
            {
                officialResultsDestination: "WCA_INTEGRATED_LIVE",
                integratedLiveConnection: "CONNECTED",
            },
            ["333-r2", "222-r1"]
        );
        // Nothing to show until the backend says a round needs someone
        expect(screen.queryByRole("dialog")).toBeNull();

        act(() => listeners.get("roundShouldBeOpened")!({ roundId: "333-r2" }));

        const dialog = await screen.findByRole("dialog", {
            name: "Open rounds in WCA Live",
        });
        expect(dialog.textContent).toContain(
            "333-r2 isn't open in WCA Integrated Live Results"
        );
        expect(dialog.textContent).not.toContain("222-r1 isn't open");
        await userEvent.click(
            screen.getByRole("button", {
                name: "Open later rounds automatically",
            })
        );

        // The other settings are sent back as they are
        expect(updateSettings).toHaveBeenCalledWith("c1", {
            scoretakingToken: "kept",
            openRoundsAutomatically: true,
        });
    });
});
