import {
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from "@testing-library/react";
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
const {
    startMatch,
    grantExtra,
    withdrawFromMatch,
    retireFromMatch,
    reopenMatch,
} = vi.hoisted(() => ({
    startMatch: vi.fn(),
    grantExtra: vi.fn(),
    withdrawFromMatch: vi.fn(),
    retireFromMatch: vi.fn(),
    reopenMatch: vi.fn(),
}));

vi.mock("@/hooks/useLiveQuery", () => ({
    useLiveQuery: () => ({ data: state.view }),
}));
vi.mock("@/lib/h2h", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    startMatch,
    grantExtra,
    withdrawFromMatch,
    retireFromMatch,
    reopenMatch,
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
        for (const action of [
            startMatch,
            grantExtra,
            withdrawFromMatch,
            retireFromMatch,
            reopenMatch,
        ]) {
            action.mockReset().mockResolvedValue({ ok: true });
        }
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

    it("offers no start while seeds are still empty", () => {
        state.view = view([
            match({
                id: "semi-2",
                status: "READY",
                sideA: { entrantId: "entrant-2", source: null },
                sideB: { entrantId: "entrant-3", source: null },
            }),
        ]);
        const draft = state.view as H2hRoundView;
        state.view = {
            ...draft,
            bracket: { ...draft.bracket, status: "DRAFT" },
        };
        render(<MatchesTab roundId="333oh-r2" />);

        expect(
            screen.queryByRole("button", { name: /Start match/ })
        ).toBeNull();
        expect(
            screen.getByText("Fill every seed in the Bracket tab to start")
        ).toBeTruthy();
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
            "",
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

    describe("when something goes wrong", () => {
        const raced = {
            ...playing,
            sets: [
                {
                    ...playing.sets[0],
                    points: [
                        point(1, 1012, 1150, "A"),
                        point(2, 1200, 1100, "B"),
                    ],
                },
            ],
        };

        it("offers Extra granted on the last point raced only, with the 11k2 reminder", async () => {
            state.view = view([raced]);
            render(<MatchesTab roundId="333oh-r2" />);

            const extras = screen.getAllByRole("button", {
                name: /^Extra granted on point/,
            });
            expect(extras).toHaveLength(1);
            fireEvent.click(extras[0]);
            const dialog = screen.getByRole("dialog", {
                name: "Extra granted on point 2",
            });
            expect(within(dialog).getByText(/Regulation 11k2/)).toBeTruthy();
            fireEvent.change(within(dialog).getByLabelText(/Comment/), {
                target: { value: "Timer reset" },
            });
            fireEvent.click(
                within(dialog).getByRole("button", { name: "Extra granted" })
            );

            await waitFor(() =>
                expect(grantExtra).toHaveBeenCalledWith(
                    "333oh-r2",
                    "point-2",
                    "Timer reset"
                )
            );
        });

        it("offers no extra while a result of the last point is missing", () => {
            state.view = view([playing]);
            render(<MatchesTab roundId="333oh-r2" />);

            expect(
                screen.queryByRole("button", { name: /^Extra granted/ })
            ).toBeNull();
        });

        it("retires a side only with a comment", async () => {
            state.view = view([raced]);
            render(<MatchesTab roundId="333oh-r2" />);

            fireEvent.click(
                screen.getByRole("button", { name: "Retire Dan Mock" })
            );
            const dialog = screen.getByRole("dialog", {
                name: "Retire Dan Mock?",
            });
            expect(
                within(dialog).getByText(/Ada Example wins Semifinal 1/)
            ).toBeTruthy();
            fireEvent.click(
                within(dialog).getByRole("button", { name: "Retire" })
            );
            expect(
                await within(dialog).findByText("Say why in the comment.")
            ).toBeTruthy();
            expect(retireFromMatch).not.toHaveBeenCalled();

            fireEvent.change(within(dialog).getByLabelText("Comment"), {
                target: { value: "Injured wrist" },
            });
            fireEvent.click(
                within(dialog).getByRole("button", { name: "Retire" })
            );
            await waitFor(() =>
                expect(retireFromMatch).toHaveBeenCalledWith(
                    "333oh-r2",
                    "semi-1",
                    "B",
                    "Injured wrist"
                )
            );
        });

        it("withdraws a side before the match starts", async () => {
            state.view = view([
                match({
                    id: "semi-2",
                    status: "READY",
                    sideA: { entrantId: "entrant-2", source: null },
                    sideB: { entrantId: "entrant-3", source: null },
                }),
            ]);
            render(<MatchesTab roundId="333oh-r2" />);

            expect(
                screen.queryByRole("button", { name: /^Retire/ })
            ).toBeNull();
            fireEvent.click(
                screen.getByRole("button", { name: "Withdraw Cleo Test" })
            );
            const dialog = screen.getByRole("dialog", {
                name: "Withdraw Cleo Test?",
            });
            fireEvent.click(
                within(dialog).getByRole("button", { name: "Withdraw" })
            );
            await waitFor(() =>
                expect(withdrawFromMatch).toHaveBeenCalledWith(
                    "333oh-r2",
                    "semi-2",
                    "B",
                    ""
                )
            );
        });

        it("keeps a refused action's dialog open with the reason", async () => {
            reopenMatch.mockResolvedValue({
                ok: false,
                message:
                    "Semifinal 1 can't be reopened: Final, which follows from it, has started",
            });
            state.view = view([
                { ...raced, status: "FINISHED", winnerSide: "A" },
            ]);
            render(<MatchesTab roundId="333oh-r2" />);

            fireEvent.click(
                screen.getByRole("button", { name: "Reopen match" })
            );
            const dialog = screen.getByRole("dialog", {
                name: "Reopen Semifinal 1?",
            });
            fireEvent.change(within(dialog).getByLabelText("Comment"), {
                target: { value: "Fraud" },
            });
            fireEvent.click(
                within(dialog).getByRole("button", { name: "Reopen match" })
            );
            expect(
                await within(dialog).findByText(/Final, which follows from it/)
            ).toBeTruthy();
            expect(reopenMatch).toHaveBeenCalledWith(
                "333oh-r2",
                "semi-1",
                "Fraud"
            );
        });

        it("marks a point whose time was amended after the match, and how the match ended", () => {
            const finished: H2hMatch = {
                ...raced,
                status: "FINISHED",
                winnerSide: "B",
                endedBy: "RETIRED",
                log: [
                    {
                        action: "RETIRE",
                        side: "A",
                        comment: "Puzzle broke",
                        createdAt: "2026-01-01T10:00:00Z",
                        createdBy: null,
                    },
                ],
                sets: [
                    {
                        ...raced.sets[0],
                        points: [
                            {
                                ...point(1, 1012, 1150, "A"),
                                amendedAfterMatch: true,
                            },
                            point(2, 1200, 1100, "B"),
                        ],
                    },
                ],
            };
            state.view = view([finished]);
            render(<MatchesTab roundId="333oh-r2" />);

            expect(screen.getByText("Retired")).toBeTruthy();
            expect(
                screen.getByText(/^Retired: Ada Example · Puzzle broke · /)
            ).toBeTruthy();
            // In the summary and on the point itself
            expect(
                screen.getAllByText(
                    "Time amended after the match, winner unchanged"
                )
            ).toHaveLength(2);
        });

        const playedOut: H2hMatch = {
            ...raced,
            status: "FINISHED",
            winnerSide: "A",
            endedBy: "PLAYED",
            reopenRefusal: null,
            score: { a: 1, b: 0 },
            sets: [
                {
                    ...raced.sets[0],
                    winnerSide: "A",
                    decidedBy: "POINTS",
                    points: [
                        point(1, 1012, 1150, "A"),
                        point(2, 1200, 1100, "B"),
                        point(3, 1000, 1100, "A"),
                        point(4, 1000, 1100, "A"),
                    ],
                },
            ],
        };

        it("offers Extra granted on the point that finished a played match", async () => {
            state.view = view([playedOut]);
            render(<MatchesTab roundId="333oh-r2" />);

            fireEvent.click(screen.getByText("Points"));
            fireEvent.click(
                screen.getByRole("button", {
                    name: "Extra granted on point 4",
                })
            );
            const dialog = screen.getByRole("dialog", {
                name: "Extra granted on point 4",
            });
            expect(
                within(dialog).getByText(/Semifinal 1 plays again/)
            ).toBeTruthy();
        });

        it("offers no extra on a point raced after the set was over", () => {
            state.view = view([
                {
                    ...playedOut,
                    sets: [
                        {
                            ...playedOut.sets[0],
                            points: [
                                point(1, 1012, 1150, "A"),
                                point(2, 1200, 1100, "A"),
                                point(3, 1000, 1100, "A"),
                                {
                                    ...point(4, 1000, 1100, null, false),
                                    afterEnd: true,
                                },
                            ],
                        },
                    ],
                },
            ]);
            render(<MatchesTab roundId="333oh-r2" />);

            fireEvent.click(screen.getByText("Points"));
            expect(
                screen.getByText(/Doesn't count: raced after the set was over/)
            ).toBeTruthy();
            expect(
                screen.queryByRole("button", { name: /^Extra granted/ })
            ).toBeNull();
        });

        it("says why a finished match can't be reopened, and who did what when", () => {
            state.view = view([
                {
                    ...playedOut,
                    reopenRefusal: "Final, which follows from it, has started",
                    log: [
                        {
                            action: "REOPEN",
                            side: null,
                            comment: "Times were typed wrong",
                            createdAt: "2026-01-01T10:00:00Z",
                            createdBy: "Eve Delegate",
                        },
                    ],
                },
            ]);
            render(<MatchesTab roundId="333oh-r2" />);

            const reopen = screen.getByRole("button", {
                name: "Reopen match",
            }) as HTMLButtonElement;
            expect(reopen.disabled).toBe(true);
            expect(
                screen.getByText(
                    /Can't reopen: Final, which follows from it, has started/
                )
            ).toBeTruthy();
            // Nor can its last point get an extra
            expect(
                screen.queryByRole("button", { name: /^Extra granted/ })
            ).toBeNull();
            expect(
                screen.getByText(
                    /^Match reopened · Times were typed wrong · by Eve Delegate, /
                )
            ).toBeTruthy();
        });

        it("labels someone who retired as retired, not withdrawn", () => {
            state.view = {
                ...view([
                    {
                        ...raced,
                        status: "FINISHED",
                        winnerSide: "B",
                        endedBy: "RETIRED",
                        log: [
                            {
                                action: "RETIRE",
                                side: "A",
                                comment: "Puzzle broke",
                                createdAt: "2026-01-01T10:00:00Z",
                                createdBy: null,
                            },
                        ],
                    },
                ]),
            };
            const withdrawn = state.view as H2hRoundView;
            if (withdrawn.bracket) {
                withdrawn.bracket.entrants = entrants.map((e) =>
                    e.id === "entrant-1"
                        ? {
                              ...e,
                              withdrawnAt: "2026-01-01T10:00:00Z",
                              withdrawnInMatchId: "semi-1",
                          }
                        : e
                );
            }
            render(<MatchesTab roundId="333oh-r2" />);

            expect(screen.getByText("(retired)")).toBeTruthy();
            expect(screen.queryByText("(withdrew)")).toBeNull();
        });

        it("asks why before reopening, and keeps the dialog open while it runs", async () => {
            reopenMatch.mockReturnValue(new Promise(() => {}));
            state.view = view([playedOut]);
            render(<MatchesTab roundId="333oh-r2" />);

            fireEvent.click(
                screen.getByRole("button", { name: "Reopen match" })
            );
            const dialog = screen.getByRole("dialog", {
                name: "Reopen Semifinal 1?",
            });
            fireEvent.click(
                within(dialog).getByRole("button", { name: "Reopen match" })
            );
            expect(
                await within(dialog).findByText("Say why in the comment.")
            ).toBeTruthy();
            expect(reopenMatch).not.toHaveBeenCalled();

            fireEvent.change(within(dialog).getByLabelText("Comment"), {
                target: { value: "Fraud" },
            });
            fireEvent.click(
                within(dialog).getByRole("button", { name: "Reopen match" })
            );
            await waitFor(() => expect(reopenMatch).toHaveBeenCalled());
            fireEvent.keyDown(dialog, { key: "Escape" });
            expect(
                screen.getByRole("dialog", { name: "Reopen Semifinal 1?" })
            ).toBeTruthy();
        });

        it("lets a stage leader start matches and nothing else", () => {
            state.view = view([
                raced,
                match({
                    id: "semi-2",
                    matchNumber: 2,
                    label: "Semifinal 2",
                    status: "READY",
                    sideA: { entrantId: "entrant-2", source: null },
                    sideB: { entrantId: "entrant-3", source: null },
                }),
            ]);
            render(<MatchesTab roundId="333oh-r2" canManage={false} />);

            expect(
                screen.getByRole("button", { name: /Start match/ })
            ).toBeTruthy();
            expect(
                screen.queryByRole("button", {
                    name: /^(Withdraw|Retire|Extra granted|Enter|Reopen)/,
                })
            ).toBeNull();
        });
    });
});
