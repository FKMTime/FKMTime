import { describe, expect, it, vi } from "vitest";

import {
    H2hBracket,
    H2hPlanRow,
    planRowChanges,
    sideLabel,
    updateSeeds,
    validateSetsToWin,
} from "@/lib/h2h";

describe("validateSetsToWin", () => {
    it("accepts a final to more sets than the third-place match", () => {
        expect(
            validateSetsToWin(8, {
                QUARTERFINAL: 1,
                SEMIFINAL: 1,
                THIRD_PLACE: 1,
                FINAL: 2,
            })
        ).toEqual([]);
    });

    it("refuses a final to fewer sets than the third-place match", () => {
        expect(
            validateSetsToWin(4, { SEMIFINAL: 1, THIRD_PLACE: 2, FINAL: 1 })
        ).toEqual([
            "Sets to win in the Final can't be lower than in the Third-place match",
        ]);
    });

    it("refuses a stage without a value, or above 3", () => {
        expect(validateSetsToWin(4, { SEMIFINAL: 4, THIRD_PLACE: 1 })).toEqual([
            "Sets to win in the Semifinal must be between 1 and 3",
            "Sets to win in the Final must be between 1 and 3",
        ]);
    });
});

const row = (id: string, scrambleSetId: string | null): H2hPlanRow => ({
    id,
    matchId: `match-${id}`,
    matchNumber: 1,
    matchLabel: "Semifinal 1",
    setNumber: 1,
    scrambleSetId,
    locked: false,
});

describe("planRowChanges", () => {
    const rows = [row("r1", "A"), row("r2", "B"), row("r3", null)];

    it("swaps two rows when a row takes a set another row has", () => {
        expect(planRowChanges(rows, "r1", "B")).toEqual([
            { id: "r1", scrambleSetId: "B" },
            { id: "r2", scrambleSetId: "A" },
        ]);
    });

    it("moves a free set into a row", () => {
        expect(planRowChanges(rows, "r3", "C")).toEqual([
            { id: "r3", scrambleSetId: "C" },
        ]);
    });

    it("empties a row", () => {
        expect(planRowChanges(rows, "r2", null)).toEqual([
            { id: "r2", scrambleSetId: null },
        ]);
    });

    it("changes nothing when the row already has the set", () => {
        expect(planRowChanges(rows, "r1", "A")).toEqual([]);
    });
});

describe("sideLabel", () => {
    const bracket = {
        entrants: [
            {
                id: "e1",
                seed: 1,
                seedTieBroken: false,
                withdrawnAt: null,
                person: {
                    id: "p1",
                    name: "Ada Example",
                    wcaId: null,
                    registrantId: 1,
                    countryIso2: null,
                },
            },
        ],
        matches: [{ matchNumber: 2, label: "Quarterfinal 2" }],
    } as unknown as H2hBracket;

    it("names the competitor in a known side", () => {
        expect(sideLabel({ entrantId: "e1", source: null }, bracket)).toBe(
            "Ada Example"
        );
    });

    it("says where an unknown side comes from", () => {
        expect(
            sideLabel(
                {
                    entrantId: null,
                    source: { matchNumber: 2, outcome: "WINNER" },
                },
                bracket
            )
        ).toBe("Winner of Quarterfinal 2");
    });
});

describe("updateSeeds without a connection", () => {
    it("says the server can't be reached instead of throwing", async () => {
        const fetch = vi
            .spyOn(globalThis, "fetch")
            .mockRejectedValue(new TypeError("Failed to fetch"));
        try {
            await expect(updateSeeds("333oh-r2", [])).resolves.toEqual({
                ok: false,
                message:
                    "Couldn't reach FKMTime. Check the connection and try again.",
            });
        } finally {
            fetch.mockRestore();
        }
    });
});
