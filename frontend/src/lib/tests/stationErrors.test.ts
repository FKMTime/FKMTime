import { describe, expect, it } from "vitest";

import { StationLastError } from "../interfaces";
import { stationErrorHint } from "../stationErrors";

const lastError = (key: string): StationLastError => ({
    key,
    kind: "problem",
    message: "",
    at: "2026-01-01T10:00:00.000Z",
    count: 1,
    cardId: null,
    competitorName: null,
});

describe("stationErrorHint for head-to-head refusals", () => {
    // Refused at the card scan as well as at the solve, so there may be
    // no solve to speak of
    it("says nothing was saved, not that a solve wasn't", () => {
        for (const key of [
            "h2hNoMatchInProgress",
            "h2hWaitingForOpponent",
            "h2hWaitingForDelegate",
            "h2hNoScrambleLeft",
        ]) {
            expect(stationErrorHint(lastError(key))).toMatch(
                /^Nothing was saved/
            );
        }
    });

    it("points at an open incident anywhere in the match", () => {
        expect(stationErrorHint(lastError("h2hWaitingForDelegate"))).toMatch(
            /an incident in the competitor's match is open/
        );
    });
});
