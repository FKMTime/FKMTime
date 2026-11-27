import { describe, expect, it } from "vitest";

import {
    isLaterPoint,
    layoutBracket,
    matchEndText,
    matchFormatText,
    matchOutcome,
    pointMarkers,
    rankedEntrants,
    setScoresText,
    slotText,
    stationOf,
} from "@/lib/h2hPublic";
import { StationInfo } from "@/lib/liveSolving";

import { buildView, entrant, point, set, withMatch } from "./h2hPublicFixtures";

const placed = (layout: ReturnType<typeof layoutBracket>) =>
    Object.fromEntries(
        layout.matches.map((p) => [p.match.matchNumber, [p.column, p.y]])
    );

const lines = (layout: ReturnType<typeof layoutBracket>) =>
    layout.connectors.map((line) => [line.from, line.to]);

describe("layoutBracket", () => {
    it("puts each quarterfinal of 12 level with the match it takes a winner from", () => {
        const layout = layoutBracket(buildView(12));
        expect(layout.columns.map((c) => c.label)).toEqual([
            "Stage of 12",
            "Quarterfinal",
            "Semifinal",
            "Final",
        ]);
        expect(placed(layout)).toEqual({
            1: [0, 0.5],
            2: [0, 1.5],
            3: [0, 2.5],
            4: [0, 3.5],
            5: [1, 0.5],
            6: [1, 1.5],
            7: [1, 2.5],
            8: [1, 3.5],
            9: [2, 1],
            10: [2, 3],
            12: [3, 2],
        });
        expect(lines(layout)).toEqual([
            [1, 5],
            [2, 6],
            [3, 7],
            [4, 8],
            [5, 9],
            [6, 9],
            [7, 10],
            [8, 10],
            [9, 12],
            [10, 12],
        ]);
        // Under the final, in its column, with no line from the semifinals
        expect(layout.thirdPlace).toMatchObject({ column: 3, y: 3.5 });
        expect(layout.thirdPlace?.match.label).toBe("Third-place match");
        expect(layout.height).toBe(4);
    });

    it("halves the matches stage by stage in a bracket of 16", () => {
        const layout = layoutBracket(buildView(16));
        expect(layout.columns.map((c) => c.stage)).toEqual([
            "STAGE_OF_16",
            "QUARTERFINAL",
            "SEMIFINAL",
            "FINAL",
        ]);
        const ys = placed(layout);
        expect([1, 2, 3, 4, 5, 6, 7, 8].map((n) => ys[n])).toEqual(
            [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5].map((y) => [0, y])
        );
        expect([9, 10, 11, 12].map((n) => ys[n])).toEqual(
            [1, 3, 5, 7].map((y) => [1, y])
        );
        expect([13, 14].map((n) => ys[n])).toEqual([
            [2, 2],
            [2, 6],
        ]);
        expect(ys[16]).toEqual([3, 4]);
        expect(layout.connectors).toHaveLength(14);
        // Each line runs from the right of its match to the next column,
        // ending level with the match it feeds
        expect(layout.connectors.find((line) => line.from === 2)).toEqual({
            from: 2,
            to: 9,
            fromColumn: 0,
            fromY: 1.5,
            toY: 1,
        });
        expect(layout.thirdPlace).toMatchObject({ column: 3, y: 5.5 });
        expect(layout.height).toBe(8);
    });

    it("makes room under the final of 4 for the third-place match", () => {
        const layout = layoutBracket(buildView(4));
        expect(placed(layout)).toEqual({ 1: [0, 0.5], 2: [0, 1.5], 4: [1, 1] });
        expect(layout.thirdPlace).toMatchObject({ column: 1, y: 2.5 });
        expect(layout.height).toBe(3);
    });
});

describe("slotText", () => {
    it("names the match an empty slot waits for", () => {
        const view = buildView(12);
        const qf1 = view.matches[4];
        const semi = view.matches[8];
        const third = view.matches[10];
        expect(slotText(view, qf1.sideA)).toBe("Competitor 1");
        expect(slotText(view, qf1.sideB)).toBe("Winner of Stage of 12 1");
        expect(slotText(view, semi.sideB)).toBe("Winner of QF 2");
        expect(slotText(view, third.sideA)).toBe("Loser of SF 2");
    });

    it("shows the competitor once the match before is decided", () => {
        const view = buildView(4);
        const final = {
            ...view.matches[3],
            sideA: { ...view.matches[3].sideA, entrantId: "e1" },
        };
        expect(slotText(view, final.sideA)).toBe("Competitor 1");
    });
});

describe("pointMarkers", () => {
    it("marks each point won, lost or with no winner, from each side", () => {
        const done = set(
            1,
            [point(1, 900, 1000), point(2, 1000, 900), point(3, 900, 900)],
            null
        );
        expect(pointMarkers(done, "A", true).slice(0, 3)).toEqual([
            "won",
            "lost",
            "none",
        ]);
        expect(pointMarkers(done, "B", true).slice(0, 3)).toEqual([
            "lost",
            "won",
            "none",
        ]);
    });

    it("shows the points a set can still take, up to the tie-break", () => {
        expect(pointMarkers(set(1, []), "A", true)).toEqual(
            Array(5).fill("pending")
        );
        // 2–1, with the next point half raced
        const playing = set(1, [
            point(1, 900, 1000),
            point(2, 900, 1000),
            point(3, 1000, 900),
            {
                ...point(4, 900, 0),
                b: null,
                decided: false,
                winnerSide: null,
            },
        ]);
        expect(pointMarkers(playing, "A", true)).toEqual([
            "won",
            "won",
            "lost",
            "pending",
            "pending",
        ]);
        // Never past the 7 points before the tie-break
        const level = set(
            1,
            Array.from({ length: 6 }, (_, i) => point(i + 1, 900, 900))
        );
        expect(pointMarkers(level, "A", true)).toHaveLength(7);
    });

    it("shows only the points played once the set is decided", () => {
        const won = set(
            1,
            [point(1, 900, 1000), point(2, 900, 1000), point(3, 900, 1000)],
            "A"
        );
        expect(pointMarkers(won, "B", true)).toEqual(["lost", "lost", "lost"]);
    });
});

describe("pointMarkers once the match is over", () => {
    it("shows nothing still to come in a set a retirement ended", () => {
        // 1–0 when B retired, with A's solve in on point 2
        const cut = set(1, [
            point(1, 900, 1000),
            { ...point(2, 900, 0), b: null, decided: false, winnerSide: null },
        ]);
        expect(pointMarkers(cut, "A", false)).toEqual(["won", "none"]);
        expect(pointMarkers(cut, "A", true)).toHaveLength(5);
    });
});

describe("isLaterPoint", () => {
    const at = (
        matchNumber: number,
        setNumber: number,
        pointNumber: number
    ) => ({
        matchNumber,
        setNumber,
        pointNumber,
    });

    it("is a later point of the same match", () => {
        expect(isLaterPoint(at(1, 1, 3), at(1, 1, 2))).toBe(true);
        expect(isLaterPoint(at(1, 2, 1), at(1, 1, 5))).toBe(true);
        expect(isLaterPoint(at(1, 1, 1), at(1, 1, 0))).toBe(true);
    });

    it("isn't another match, or a point gone back to undecided", () => {
        expect(isLaterPoint(at(2, 1, 3), at(1, 1, 2))).toBe(false);
        expect(isLaterPoint(at(1, 1, 2), at(1, 1, 3))).toBe(false);
        expect(isLaterPoint(at(1, 1, 3), at(1, 1, 3))).toBe(false);
    });
});

describe("match texts", () => {
    it("writes the format and the sets' point scores", () => {
        expect(matchFormatText(2)).toBe("First to 2 sets · first to 3 points");
        expect(matchFormatText(1)).toBe("First to 1 set · first to 3 points");
        expect(
            setScoresText({
                sets: [
                    set(1, [point(1, 1, 2), point(2, 1, 2), point(3, 1, 2)]),
                    set(2, [point(1, 2, 1), point(2, 2, 1), point(3, 2, 1)]),
                ],
            })
        ).toBe("3–0 · 0–3");
    });

    it("says in plain words how a walkover or a retirement ended", () => {
        const view = buildView(4);
        const walkover = withMatch(view, 1, {
            status: "FINISHED",
            winnerSide: "A",
            endedBy: "WALKOVER",
        });
        expect(matchEndText(walkover, walkover.matches[0])).toBe(
            "Walkover: Competitor 4 withdrew"
        );
        const retired = withMatch(view, 2, {
            status: "FINISHED",
            winnerSide: "B",
            endedBy: "RETIRED",
        });
        expect(matchEndText(retired, retired.matches[1])).toBe(
            "Competitor 2 retired"
        );
        expect(matchEndText(view, view.matches[0])).toBeNull();
    });
});

describe("matchOutcome", () => {
    it("names the winner and who they play next, from the bracket", () => {
        const view = withMatch(buildView(4), 1, {
            status: "FINISHED",
            winnerSide: "A",
            endedBy: "PLAYED",
        });
        expect(matchOutcome(view, view.matches[0])).toEqual({
            winnerName: "Competitor 1",
            how: "wins Semifinal 1",
            next: "Next: Final against Winner of SF 2",
        });
        // Once the other semifinal is decided, the opponent is named
        const both = withMatch(
            withMatch(view, 4, {
                sideB: {
                    entrantId: "e3",
                    source: view.matches[3].sideB.source,
                },
            }),
            2,
            { status: "FINISHED", winnerSide: "B", endedBy: "PLAYED" }
        );
        expect(matchOutcome(both, both.matches[0])?.next).toBe(
            "Next: Final against Competitor 3"
        );
    });

    it("has nothing to say before the end, and no next match after the final", () => {
        const view = buildView(4);
        expect(matchOutcome(view, view.matches[0])).toBeNull();
        const final = withMatch(view, 4, {
            status: "FINISHED",
            winnerSide: "B",
            endedBy: "PLAYED",
            sideA: {
                entrantId: "e1",
                source: { matchNumber: 1, outcome: "WINNER" },
            },
            sideB: {
                entrantId: "e2",
                source: { matchNumber: 2, outcome: "WINNER" },
            },
        });
        expect(matchOutcome(final, final.matches[3])).toEqual({
            winnerName: "Competitor 2",
            how: "wins the final",
            next: null,
        });
    });
});

describe("stationOf", () => {
    const station = (espId: number, registrantId: number, at: number) =>
        ({ espId, registrantId, serverReceivedAt: at }) as StationInfo;

    it("finds a competitor's station by registrant id, the latest one first", () => {
        const stations = [
            station(1, 101, 10),
            station(2, 102, 10),
            station(3, 101, 20),
        ];
        expect(stationOf(stations, 101)?.espId).toBe(3);
        expect(stationOf(stations, 103)).toBeNull();
        expect(stationOf(stations, null)).toBeNull();
    });
});

describe("rankedEntrants", () => {
    it("orders by position, then by best single, DNF before no attempt", () => {
        const list = [
            { ...entrant(1), position: null, bestSingle: null },
            { ...entrant(2), position: 2, bestSingle: 1000 },
            { ...entrant(3), position: null, bestSingle: -1 },
            { ...entrant(4), position: 1, bestSingle: 1100 },
            { ...entrant(5), position: null, bestSingle: 900 },
        ];
        expect(rankedEntrants(list).map((e) => e.seed)).toEqual([
            4, 2, 5, 3, 1,
        ]);
    });
});
