import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Room, ScrambleSet } from "@/lib/interfaces";
import {
    createScrambledAttempt,
    getPersonByCardId,
    getScrambleData,
} from "@/lib/scrambling";

import ScramblesList from "./AllScrambles/Components/ScramblesList";
import ScrambleSetsList from "./Home/Components/ScrambleSetsList";
import Scrambling from "./ScrambleSet/Components/Scrambling";
import {
    currentGroupIdForRound,
    scrambleCountLabel,
} from "./scramblingDeviceContext";

vi.mock("@/lib/scrambling", () => ({
    getPersonByCardId: vi.fn(),
    getScrambleData: vi.fn(),
    createScrambledAttempt: vi.fn(),
}));

const scrambleSet = (overrides: Partial<ScrambleSet> = {}): ScrambleSet => ({
    id: "set-a",
    roundId: "333-r1",
    set: "A",
    scramblesCount: 5,
    extraScramblesCount: 2,
    ...overrides,
});

const room: Room = {
    id: "room-1",
    name: "Hall",
    color: "#000000",
    currentGroupIds: ["333-r1-g2", "pyram-r1-g1"],
};

const scrambler = {
    id: "scrambler",
    name: "Sam Scrambler",
    wcaId: "2020SCRA01",
    cardId: "100",
};
const competitor = {
    id: "competitor",
    name: "Casey Competitor",
    wcaId: null,
    cardId: "200",
};

const scan = (label: string, cardId: string) => {
    const input = screen.getByLabelText(label);
    fireEvent.change(input, { target: { value: cardId } });
    fireEvent.keyDown(input, { key: "Enter" });
};

describe("scramblingDeviceContext helpers", () => {
    it("labels scramble and extra counts", () => {
        expect(scrambleCountLabel(scrambleSet())).toBe(
            "5 scrambles · 2 extras"
        );
        expect(
            scrambleCountLabel(
                scrambleSet({ scramblesCount: 1, extraScramblesCount: 1 })
            )
        ).toBe("1 scramble · 1 extra");
        expect(
            scrambleCountLabel(scrambleSet({ extraScramblesCount: 0 }))
        ).toBe("5 scrambles");
    });

    it("finds the room's current group for a round", () => {
        expect(currentGroupIdForRound(room, "333-r1")).toBe("333-r1-g2");
        expect(currentGroupIdForRound(room, "333-r2")).toBeUndefined();
        expect(currentGroupIdForRound(null, "333-r1")).toBeUndefined();
    });
});

describe("ScrambleSetsList", () => {
    const renderList = (canScramble: boolean, sets = [scrambleSet()]) =>
        render(
            <MemoryRouter>
                <ScrambleSetsList
                    scrambleSets={sets}
                    canScramble={canScramble}
                />
            </MemoryRouter>
        );

    it("offers Scramble with All scrambles in the menu when the round is live here", () => {
        renderList(true);
        expect(screen.getByRole("button", { name: "Scramble" })).toBeTruthy();
        expect(
            screen.getByRole("button", { name: "More actions for Set A" })
        ).toBeTruthy();
        expect(
            screen.queryByRole("button", { name: "All scrambles" })
        ).toBeNull();
    });

    it("offers only All scrambles otherwise", () => {
        renderList(false);
        expect(
            screen.getByRole("button", { name: "All scrambles" })
        ).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Scramble" })).toBeNull();
    });

    it("shows the empty state", () => {
        renderList(true, []);
        expect(
            screen.getByText("No scramble sets for this round")
        ).toBeTruthy();
    });
});

describe("Scrambling", () => {
    beforeEach(() => {
        vi.mocked(getPersonByCardId).mockReset();
        vi.mocked(getScrambleData).mockReset();
        vi.mocked(createScrambledAttempt).mockReset();
    });

    const renderScrambling = () =>
        render(
            <Scrambling
                groupId="333-r1-g2"
                scrambles={[
                    {
                        id: "s1",
                        num: 1,
                        isExtra: false,
                        scramble: "R U R' U'",
                    },
                ]}
            />
        );

    it("asks for the scrambler, then the competitor, then shows the scramble", async () => {
        vi.mocked(getPersonByCardId).mockResolvedValue(scrambler);
        vi.mocked(getScrambleData).mockResolvedValue({
            status: 200,
            data: {
                person: competitor,
                scrambleData: { num: 1, isExtra: false },
            },
        });
        renderScrambling();

        scan("Scan the scrambler's card", "100");
        await screen.findByText("Sam Scrambler");

        scan("Scan the competitor's card", "200");
        expect(await screen.findByText("Casey Competitor")).toBeTruthy();
        expect(screen.getByText("Newcomer")).toBeTruthy();
        expect(screen.getByText("Scramble 1")).toBeTruthy();
        expect(screen.getByText("R U R' U'")).toBeTruthy();
        expect(getScrambleData).toHaveBeenCalledWith("200", "333-r1");
    });

    it("rejects the scrambler's own card as the competitor", async () => {
        vi.mocked(getPersonByCardId).mockResolvedValue(scrambler);
        renderScrambling();

        scan("Scan the scrambler's card", "100");
        await screen.findByText("Sam Scrambler");
        scan("Scan the competitor's card", "100");

        expect(screen.getByRole("alert").textContent).toBe(
            "Scrambler and competitor cannot be the same"
        );
        expect(getScrambleData).not.toHaveBeenCalled();
    });

    it("shows inline when the competitor has no attempts left", async () => {
        vi.mocked(getPersonByCardId).mockResolvedValue(scrambler);
        vi.mocked(getScrambleData).mockResolvedValue({
            status: 200,
            data: {
                person: competitor,
                scrambleData: { num: -1, isExtra: false },
            },
        });
        renderScrambling();

        scan("Scan the scrambler's card", "100");
        await screen.findByText("Sam Scrambler");
        scan("Scan the competitor's card", "200");

        await waitFor(() =>
            expect(screen.getByRole("alert").textContent).toBe(
                "No attempts left"
            )
        );
    });
});

describe("ScramblesList", () => {
    it("lists regular scrambles before extras", () => {
        render(
            <ScramblesList
                eventId="333"
                scrambles={[
                    { id: "e1", num: 1, isExtra: true, scramble: "F" },
                    { id: "s2", num: 2, isExtra: false, scramble: "U" },
                    { id: "s1", num: 1, isExtra: false, scramble: "R" },
                ]}
            />
        );
        const badges = screen
            .getAllByRole("listitem")
            .map((item) => item.firstElementChild?.textContent);
        expect(badges).toEqual(["1", "2", "E1"]);
    });
});
