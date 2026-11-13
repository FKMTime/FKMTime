import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearQueryCache } from "@/lib/queryCache";
import { renderWithQueryClient } from "@/test/queryClient";

import AddCompetitorToRoundModal from "./AddCompetitorToRoundModal";

const fetchAddable = vi.hoisted(() => vi.fn());
const addCompetitor = vi.hoisted(() => vi.fn());

vi.mock("@/lib/integratedLive", () => ({
    integratedLiveAddableQuery: (roundId: string) => ({
        key: `competition/integrated-live/rounds/${roundId}/addable`,
        fetch: fetchAddable,
    }),
    addCompetitorToIntegratedLiveRound: addCompetitor,
    invalidateIntegratedLiveRounds: vi.fn(),
}));
vi.mock("@/lib/activities", () => ({
    activityCodeToName: (id: string) => id,
}));

describe("AddCompetitorToRoundModal", () => {
    beforeEach(() => {
        clearQueryCache();
        fetchAddable.mockReset();
        addCompetitor.mockReset();
    });

    it("adds the chosen competitor to the round", async () => {
        fetchAddable.mockResolvedValue([
            { registrationId: 7, name: "Ada Example", wcaId: "2020EXAM01" },
        ]);
        addCompetitor.mockResolvedValue({ ok: true, message: "Added" });
        const onClose = vi.fn();
        renderWithQueryClient(
            <AddCompetitorToRoundModal
                isOpen
                onClose={onClose}
                roundId="333-r1"
            />
        );

        await userEvent.click(
            await screen.findByRole("combobox", { name: "Competitor" })
        );
        await userEvent.click(
            await screen.findByRole("option", {
                name: "Ada Example (2020EXAM01)",
            })
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Add to round" })
        );

        expect(addCompetitor).toHaveBeenCalledWith("333-r1", 7);
        expect(onClose).toHaveBeenCalled();
    });

    it("keeps the dialog open with the WCA's reason when adding fails", async () => {
        fetchAddable.mockResolvedValue([
            { registrationId: 7, name: "Ada Example", wcaId: null },
        ]);
        addCompetitor.mockResolvedValue({
            ok: false,
            message: "round is not open",
        });
        const onClose = vi.fn();
        renderWithQueryClient(
            <AddCompetitorToRoundModal
                isOpen
                onClose={onClose}
                roundId="333-r1"
            />
        );

        await userEvent.click(
            await screen.findByRole("combobox", { name: "Competitor" })
        );
        await userEvent.click(
            await screen.findByRole("option", { name: "Ada Example" })
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Add to round" })
        );

        expect(await screen.findByText("round is not open")).toBeTruthy();
        expect(onClose).not.toHaveBeenCalled();
    });
});
