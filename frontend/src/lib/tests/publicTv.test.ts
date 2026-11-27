import { describe, expect, it } from "vitest";

import {
    getTvH2hRounds,
    getTvSlides,
    getTvZoom,
    stepSlide,
} from "@/lib/publicTv";
import { buildView, withMatch } from "@/lib/tests/h2hPublicFixtures";

describe("public TV view", () => {
    it("starts with live solving, then each round in progress", () => {
        expect(getTvSlides(["333-r1", "pyram-r1"])).toEqual([
            { type: "live" },
            { type: "results", roundId: "333-r1" },
            { type: "results", roundId: "pyram-r1" },
        ]);
        expect(getTvSlides([])).toEqual([{ type: "live" }]);
    });

    it("leads with a head-to-head round's bracket between its matches", () => {
        expect(
            getTvSlides(
                ["333-r1", "333oh-r2"],
                [{ roundId: "333oh-r2", playingMatchNumbers: [] }]
            )
        ).toEqual([
            { type: "h2hBracket", roundId: "333oh-r2" },
            { type: "live" },
            { type: "results", roundId: "333-r1" },
        ]);
    });

    it("replaces the rotation with the scoreboard while a match is played", () => {
        expect(
            getTvSlides(
                ["333-r1", "333oh-r2"],
                [{ roundId: "333oh-r2", playingMatchNumbers: [5] }]
            )
        ).toEqual([{ type: "h2hMatch", roundId: "333oh-r2", matchNumber: 5 }]);
        // Two matches at once take turns
        expect(
            getTvSlides(
                ["333oh-r2"],
                [{ roundId: "333oh-r2", playingMatchNumbers: [1, 2] }]
            )
        ).toEqual([
            { type: "h2hMatch", roundId: "333oh-r2", matchNumber: 1 },
            { type: "h2hMatch", roundId: "333oh-r2", matchNumber: 2 },
        ]);
    });

    it("never shows a head-to-head round as results, even before its bracket loads", () => {
        // Not loaded, failed or not created yet: the bracket slide waits
        const rounds = getTvH2hRounds("333oh-r2", undefined);
        expect(rounds).toEqual([
            { roundId: "333oh-r2", playingMatchNumbers: [] },
        ]);
        expect(getTvSlides(["333-r1", "333oh-r2"], rounds)).toEqual([
            { type: "h2hBracket", roundId: "333oh-r2" },
            { type: "live" },
            { type: "results", roundId: "333-r1" },
        ]);
        expect(getTvH2hRounds(null, undefined)).toEqual([]);
    });

    it("leaves out a second head-to-head round rather than rank it as results", () => {
        expect(
            getTvSlides(
                ["333oh-r2", "222-r3", "333-r1"],
                getTvH2hRounds("333oh-r2", undefined),
                ["333oh-r2", "222-r3"]
            )
        ).toEqual([
            { type: "h2hBracket", roundId: "333oh-r2" },
            { type: "live" },
            { type: "results", roundId: "333-r1" },
        ]);
    });

    it("takes the playing matches from the round's own bracket", () => {
        const view = withMatch(buildView(4), 2, { status: "IN_PROGRESS" });
        expect(getTvH2hRounds(view.roundId, view)).toEqual([
            { roundId: view.roundId, playingMatchNumbers: [2] },
        ]);
        // Another round's bracket, still in the cache: nothing is playing
        expect(getTvH2hRounds("444-r2", view)).toEqual([
            { roundId: "444-r2", playingMatchNumbers: [] },
        ]);
    });

    it("steps through slides and wraps around both ways", () => {
        expect(stepSlide(0, 3)).toBe(1);
        expect(stepSlide(2, 3)).toBe(0);
        expect(stepSlide(0, 3, -1)).toBe(2);
        // A round finished and the list shrank under the current index
        expect(stepSlide(4, 2)).toBe(1);
        expect(stepSlide(0, 0)).toBe(0);
    });

    it("scales the stage up with the screen, never down", () => {
        expect(getTvZoom(1920, 1080)).toBe(1.5);
        expect(getTvZoom(3840, 2160)).toBe(3);
        expect(getTvZoom(1024, 768)).toBe(1);
        // Limited by the shorter side on unusual aspect ratios
        expect(getTvZoom(2560, 720)).toBe(1);
    });
});
