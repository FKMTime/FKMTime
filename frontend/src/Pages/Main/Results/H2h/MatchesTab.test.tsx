import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    H2hBracket,
    H2hEntrant,
    H2hMatch,
    H2hPoint,
    H2hRoundView,
} from "@/lib/h2h";

import MatchesTab from "./MatchesTab";

const state = vi.hoisted(() => ({ view: undefined as unknown }));
const { startMatch } = vi.hoisted(() => ({ startMatch: vi.fn() }));

vi.mock("@/hooks/useLiveQuery", () => ({
    useLiveQuery: () => ({ data: state.view }),
}));
vi.mock("@/lib/h2h", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    startMatch,
}));
// The entry form has its own tests; here only who it opens for matters
vi.mock("../Components/CreateAttemptModal", () => ({
    default: ({ title }: { title: string }) => (
        <div role="dialog" aria-label={title} />
    ),
}));

const entrant = (seed: number, name: string): H2hEntrant => ({
    id: `entrant-${seed}`,
    seed,
    seedTieBroken: false,
    withdrawnAt: null,
    person: {
        id: `person-${seed}`,
        name,
        wcaId: null,
        registrantId: seed,
        countryIso2: null,
    },
    bestSingle: null,
    position: null,
    stageReached: null,
});

// Invented competitors
const entrants = [
    entrant(1, "Ada Example"),
    entrant(2, "Ben Sample"),
    entrant(3, "Cleo Test"),
    entrant(4, "Dan Mock"),
];

const attempt = (value: number, penalty = 0) => ({
    id: `attempt-${value}-${penalty}`,
    attemptNumber: 1,
    value,
    penalty,
});

const point = (
    pointNumber: number,
    a: number | null,
    b: number | null,
    winnerSide: "A" | "B" | null,
    decided = a !== null && b !== null
): H2hPoint => ({
    id: `point-${pointNumber}`,
    pointNumber,
    winnerSide,
    decided,
    attemptA: a === null ? null : attempt(a),
    attemptB: b === null ? null : attempt(b, b === 1 ? -1 : 0),
    scramble: { set: "A", num: pointNumber, isExtra: false },
});

const match = (overrides: Partial<H2hMatch>): H2hMatch => ({
    id: "match",
    matchNumber: 1,
    label: "Semifinal 1",
    stage: "SEMIFINAL",
    setsToWin: 1,
    status: "WAITING",
    winnerSide: null,
    sideA: { entrantId: null, source: null },
    sideB: { entrantId: null, source: null },
    score: { a: 0, b: 0 },
    sets: [],
    scrambleInUse: null,
    ...overrides,
});

const bracket = (matches: H2hMatch[]): H2hBracket => ({
    id: "bracket",
    size: 4,
    status: "IN_PROGRESS",
    wcaRoundId: null,
    seedsLocked: true,
    attemptsLinked: true,
    stages: [],
    entrants,
    matches,
});

const view = (matches: H2hMatch[]): H2hRoundView => ({
    roundId: "333oh-r2",
    eventId: "333oh",
    cannotCreate: null,
    suggestedSize: 4,
    candidates: [],
    bracket: bracket(matches),
    scramblePlan: null,
});

const playing = match({
    id: "semi-1",
    status: "IN_PROGRESS",
    sideA: { entrantId: "entrant-1", source: null },
    sideB: { entrantId: "entrant-4", source: null },
    sets: [
        {
            setNumber: 1,
            winnerSide: null,
            decidedBy: null,
            scrambleSet: { id: "set-a", set: "A" },
            // Ada won point 1, nobody point 2; Ada is a point ahead on 3
            points: [
                point(1, 1012, 1150, "A"),
                point(2, 1200, 1, null),
                point(3, 990, null, null),
            ],
        },
    ],
    scrambleInUse: {
        pointNumber: 3,
        text: "Semifinal 1 · set 1 · Set A, scramble 3",
        warning: null,
    },
});

describe("MatchesTab", () => {
    beforeEach(() => {
        startMatch.mockReset().mockResolvedValue({ ok: true });
    });

    it("lists the matches in order with their status, and starts a ready one", () => {
        state.view = view([
            match({
                id: "final",
                matchNumber: 4,
                label: "Final",
                stage: "FINAL",
                sideA: {
                    entrantId: null,
                    source: { matchNumber: 1, outcome: "WINNER" },
                },
            }),
            match({
                id: "semi-2",
                matchNumber: 2,
                label: "Semifinal 2",
                status: "READY",
                sideA: { entrantId: "entrant-2", source: null },
                sideB: { entrantId: "entrant-3", source: null },
            }),
            { ...playing, matchNumber: 1 },
        ]);
        render(<MatchesTab roundId="333oh-r2" />);

        const items = screen.getAllByRole("listitem");
        expect(items.map((item) => item.getAttribute("aria-label"))).toEqual([
            "Semifinal 1",
            "Semifinal 2",
            "Final",
        ]);
        expect(within(items[0]).getByText("Playing")).toBeTruthy();
        expect(within(items[1]).getByText("Ready")).toBeTruthy();
        expect(within(items[2]).getByText("Waiting")).toBeTruthy();
        expect(
            within(items[2]).getByText("Winner of Semifinal 1")
        ).toBeTruthy();
        expect(
            screen.getAllByRole("button", { name: /Start match/ })
        ).toHaveLength(1);

        fireEvent.click(
            within(items[1]).getByRole("button", { name: /Start match/ })
        );
        expect(startMatch).toHaveBeenCalledWith("333oh-r2", "semi-2");
    });

    it("logs the playing match point by point, with the scramble in use", () => {
        state.view = view([playing]);
        render(<MatchesTab roundId="333oh-r2" />);

        expect(
            screen.getByText("Semifinal 1 · set 1 · Set A, scramble 3")
        ).toBeTruthy();
        const set = screen.getByRole("region", { name: "Set 1" });
        expect(within(set).getByText("Set 1 · 1–0")).toBeTruthy();
        const rows = within(set)
            .getAllByRole("row")
            .slice(1)
            .map((row) =>
                within(row)
                    .getAllByRole("cell")
                    .map((cell) => cell.textContent)
            );
        expect(rows[0]).toEqual([
            "1",
            "10.12",
            "11.50",
            "Ada Example",
            "Set A, scramble 1",
        ]);
        expect(rows[1].slice(1, 4)).toEqual(["12.00", "DNF", "No winner"]);
    });

    it("offers entry for the missing result only, not a second point ahead", () => {
        state.view = view([playing]);
        render(<MatchesTab roundId="333oh-r2" />);

        // Dan owes point 3; Ada is a point ahead, so has nothing to enter
        expect(
            screen.getAllByRole("button", { name: /^Enter .*'s result$/ })
        ).toHaveLength(1);
        fireEvent.click(
            screen.getByRole("button", { name: "Enter Dan Mock's result" })
        );
        expect(
            screen.getByRole("dialog", { name: "Dan Mock's result" })
        ).toBeTruthy();
    });

    it("says how a finished set was decided, in plain words", () => {
        state.view = view([
            {
                ...playing,
                setsToWin: 2,
                score: { a: 0, b: 1 },
                sets: [
                    {
                        setNumber: 1,
                        winnerSide: "B",
                        decidedBy: "BEST_IN_SET",
                        scrambleSet: { id: "set-a", set: "A" },
                        points: [point(1, 1012, 1150, "A")],
                    },
                    {
                        setNumber: 2,
                        winnerSide: null,
                        decidedBy: null,
                        scrambleSet: { id: "set-b", set: "B" },
                        points: [],
                    },
                ],
            },
        ]);
        render(<MatchesTab roundId="333oh-r2" />);

        expect(
            screen.getByText("Dan Mock: Won on the better single in the set")
        ).toBeTruthy();
        // Both start set 2's first point
        expect(
            screen.getAllByRole("button", { name: /^Enter .*'s result$/ })
        ).toHaveLength(2);
    });
});
