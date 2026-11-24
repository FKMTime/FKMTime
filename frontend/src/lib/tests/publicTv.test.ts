import { describe, expect, it } from "vitest";

import { getTvSlides, getTvZoom, stepSlide } from "@/lib/publicTv";

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
