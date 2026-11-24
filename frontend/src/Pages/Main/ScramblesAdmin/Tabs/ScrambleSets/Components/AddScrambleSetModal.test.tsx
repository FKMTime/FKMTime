import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider } from "jotai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { competitionAtom } from "@/lib/atoms";
import { Competition } from "@/lib/interfaces";
import { addScrambles } from "@/lib/scramblesImport";
import { renderWithQueryClient } from "@/test/queryClient";

import AddScrambleSetModal from "./AddScrambleSetModal";

vi.mock("@/lib/scramblesImport", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/scramblesImport")>()),
    addScrambles: vi.fn(),
}));
vi.mock("@/lib/events", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/events")>()),
    getEventName: (eventId: string) =>
        ({ "333": "3x3x3 Cube", "222": "2x2x2 Cube" })[eventId],
}));
vi.mock("@/lib/activities", () => ({
    activityCodeToName: (id: string) => id,
}));

const competition = {
    wcif: {
        events: [
            { id: "333", rounds: [{ id: "333-r1" }, { id: "333-r2" }] },
            { id: "222", rounds: [{ id: "222-r1" }] },
        ],
    },
} as unknown as Competition;

const scrambleFile = (roundIds: string[]) => {
    const events = new Map<string, { id: string; rounds: unknown[] }>();
    for (const roundId of roundIds) {
        const eventId = roundId.split("-")[0];
        const event = events.get(eventId) ?? { id: eventId, rounds: [] };
        event.rounds.push({
            id: roundId,
            scrambleSets: [
                { id: 1, scrambles: ["encrypted"], extraScrambles: [] },
            ],
        });
        events.set(eventId, event);
    }
    return new File(
        [JSON.stringify({ wcif: { events: [...events.values()] } })],
        "scrambles.json",
        { type: "application/json" }
    );
};

const renderModal = (roundId = "333-r2") => {
    const store = createStore();
    store.set(competitionAtom, competition);
    const onClose = vi.fn();
    const modal = (isOpen: boolean, round: string) => (
        <Provider store={store}>
            <AddScrambleSetModal
                isOpen={isOpen}
                onClose={onClose}
                lastSet={2}
                roundId={round}
            />
        </Provider>
    );
    const { rerender } = renderWithQueryClient(modal(true, roundId));
    return {
        onClose,
        reopen: (round = roundId) => {
            rerender(modal(false, round));
            rerender(modal(true, round));
        },
    };
};

const upload = (file: File) =>
    userEvent.upload(screen.getByLabelText("Upload scrambles"), file);

const addButton = () =>
    screen.getByRole<HTMLButtonElement>("button", { name: "Add" });

describe("AddScrambleSetModal", () => {
    beforeEach(() => {
        vi.mocked(addScrambles).mockReset();
    });

    it("adds the file's Round 1 set to the round the dialog is open for", async () => {
        vi.mocked(addScrambles).mockResolvedValue({ status: 201, data: {} });
        const { onClose } = renderModal("333-r2");

        await upload(scrambleFile(["333-r1"]));
        await vi.waitFor(() => expect(addButton().disabled).toBe(false));
        await userEvent.click(addButton());

        expect(addScrambles).toHaveBeenCalledWith([
            expect.objectContaining({ roundId: "333-r2", set: "C" }),
        ]);
        expect(onClose).toHaveBeenCalled();
    });

    it("shows an error and disables Add for a file without the event's Round 1", async () => {
        renderModal("333-r2");

        await upload(scrambleFile(["333-r2", "222-r1"]));

        await screen.findByText(
            "This file has no scramble sets for 3x3x3 Cube Round 1"
        );
        expect(addButton().disabled).toBe(true);
    });

    it("forgets the uploaded file when the dialog closes", async () => {
        const { reopen } = renderModal("333-r2");
        await upload(scrambleFile(["333-r1", "222-r1"]));
        await vi.waitFor(() => expect(addButton().disabled).toBe(false));

        await userEvent.keyboard("{Escape}");
        reopen("222-r1");

        expect(addButton().disabled).toBe(true);
        expect(addScrambles).not.toHaveBeenCalled();
    });
});
