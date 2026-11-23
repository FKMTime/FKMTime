import { describe, expect, it } from "vitest";
import { Competition as WCIF } from "wcif-helpers";

import { getScrambleSetsToAdd } from "./scramblesImport";

const scrambleSet = (id: number) => ({
    id,
    scrambles: [`scramble-${id}`],
    extraScrambles: [`extra-${id}`],
});

const scrambleFile = (rounds: Record<string, number[]>) => {
    const events = new Map<string, { id: string; rounds: unknown[] }>();
    for (const [roundId, setIds] of Object.entries(rounds)) {
        const eventId = roundId.split("-")[0];
        const event = events.get(eventId) ?? { id: eventId, rounds: [] };
        event.rounds.push({
            id: roundId,
            scrambleSets: setIds.map(scrambleSet),
        });
        events.set(eventId, event);
    }
    return { events: [...events.values()] } as unknown as WCIF;
};

const summary = (roundId: string, wcif: WCIF, startFrom: number) =>
    getScrambleSetsToAdd(roundId, wcif, startFrom).map(
        (set) => `${set.roundId}:${set.set}`
    );

describe("getScrambleSetsToAdd", () => {
    it("files a Round 1 set under the round the sets are added to", () => {
        const wcif = scrambleFile({ "333-r1": [1] });

        expect(summary("333-r2", wcif, 3)).toEqual(["333-r2:C"]);
    });

    it("takes only the event's Round 1 sets from a file with several rounds and events", () => {
        const wcif = scrambleFile({
            "333-r1": [1, 2],
            "333-r2": [3],
            "222-r1": [4],
        });

        expect(summary("333-r3", wcif, 1)).toEqual(["333-r3:A", "333-r3:B"]);
    });

    it("keeps the scrambles of the source set", () => {
        const wcif = scrambleFile({ "333-r1": [7] });

        expect(getScrambleSetsToAdd("333-r2", wcif, 3)[0].scrambles).toEqual([
            { num: 1, encryptedScramble: "scramble-7", isExtra: false },
            { num: 1, encryptedScramble: "extra-7", isExtra: true },
        ]);
    });

    it("returns nothing when the file has no Round 1 sets for the event", () => {
        const wcif = scrambleFile({ "333-r2": [1], "222-r1": [2] });

        expect(getScrambleSetsToAdd("333-r2", wcif, 3)).toEqual([]);
    });
});
