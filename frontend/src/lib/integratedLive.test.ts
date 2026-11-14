import { describe, expect, it } from "vitest";

import { liveStatusLine, registrationHint } from "./integratedLive";
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

describe("registrationHint", () => {
    const rules = (
        overrides: Partial<{
            eventChangeDeadline: string | null;
            onTheSpotRegistration: boolean;
            competitorLimit: number | null;
        }> = {}
    ) => ({
        eventChangeDeadline: null,
        onTheSpotRegistration: false,
        competitorLimit: null,
        ...overrides,
    });
    const now = new Date("2026-11-13T10:00:00Z");
    const notRegistered = "Not registered for 333 on the WCA website";

    it("points to the deadline for adding events while it is open", () => {
        expect(
            registrationHint(
                notRegistered,
                rules({ eventChangeDeadline: "2026-11-14T10:00:00Z" }),
                now
            )
        ).toMatch(/until .* \(WCRP 6\.4\)/);
    });

    it("leaves it to the Delegate once the deadline passed", () => {
        expect(
            registrationHint(
                notRegistered,
                rules({ eventChangeDeadline: "2026-11-01T10:00:00Z" }),
                now
            )
        ).toMatch(/WCRP 6\.4\.4/);
    });

    it("explains the rule with no deadline", () => {
        expect(registrationHint(notRegistered, rules(), now)).toMatch(
            /WCRP 6\.4\.2\b.*WCRP 6\.4\.2\.1/
        );
    });

    it("warns about on-site registration and the competitor limit", () => {
        const hint = registrationHint(
            "No accepted WCA registration",
            rules({ onTheSpotRegistration: true, competitorLimit: 60 }),
            now
        );
        expect(hint).toMatch(/Regulation 2c1/);
        expect(hint).toMatch(/limit \(60\).*WCRP 5\.2\.1/);
        expect(
            registrationHint("No accepted WCA registration", rules(), now)
        ).not.toMatch(/5\.2\.1/);
    });

    it("has nothing to say about other reasons", () => {
        expect(
            registrationHint("Attempts after a missed cutoff", rules(), now)
        ).toBeNull();
        expect(registrationHint(null, rules(), now)).toBeNull();
    });
});
