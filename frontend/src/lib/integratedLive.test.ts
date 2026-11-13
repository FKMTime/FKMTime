import { describe, expect, it } from "vitest";

import { liveStatusLine } from "./integratedLive";
import { IntegratedLiveRoundDetails } from "./interfaces";

const details = (
    overrides: Partial<IntegratedLiveRoundDetails>
): IntegratedLiveRoundDetails => ({
    roundId: "333-r1",
    state: "open",
    totalCompetitors: 40,
    completedCompetitors: 38,
    waitingReason: null,
    onTheWay: 0,
    needsAttention: 0,
    results: [],
    onlyInWca: [],
    ...overrides,
});

describe("liveStatusLine", () => {
    it("sums up an open round", () => {
        expect(liveStatusLine(details({}))).toBe(
            "open, 38 of 40 done, all sent"
        );
        expect(liveStatusLine(details({ onTheWay: 2 }))).toBe(
            "open, 38 of 40 done, 2 sending"
        );
        expect(
            liveStatusLine(details({ onTheWay: 2, needsAttention: 1 }))
        ).toBe("open, 38 of 40 done, 1 need attention");
    });

    it("gives the reason instead when the round can't open", () => {
        expect(
            liveStatusLine(
                details({
                    state: "pending",
                    waitingReason: "Waiting for 333-r1: 2 empty results",
                })
            )
        ).toBe("Waiting for 333-r1: 2 empty results");
    });

    it("names the other states plainly", () => {
        expect(liveStatusLine(details({ state: "locked" }))).toBe("done");
        expect(liveStatusLine(details({ state: "ready" }))).toBe(
            "ready to open"
        );
    });
});
