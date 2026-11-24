import { describe, expect, it } from "vitest";
import { Competition } from "wcif-helpers";

import { validateScrambles } from "@/lib/scramblesImport";

/** Encrypted scrambles have no spaces; the check for plain text looks for one */
const scrambles = (count: number) =>
    Array.from({ length: count }, (_, i) => `encrypted${i}`);

const set = (count = 5, extras = 2) => ({
    id: 0,
    scrambles: scrambles(count),
    extraScrambles: scrambles(extras),
});

/** A 333oh event: an Ao5 first round and a head-to-head final */
const competition = (setCounts = { r1: 2, r2: 7 }) =>
    ({
        events: [
            {
                id: "333oh",
                rounds: [
                    {
                        id: "333oh-r1",
                        format: "a",
                        scrambleSetCount: setCounts.r1,
                    },
                    {
                        id: "333oh-r2",
                        format: "h",
                        scrambleSetCount: setCounts.r2,
                    },
                ],
            },
        ],
    }) as unknown as Competition;

const scramblesFile = (r1Sets: unknown[], r2Sets: unknown[] | null) =>
    ({
        events: [
            {
                id: "333oh",
                rounds: [
                    { id: "333oh-r1", scrambleSets: r1Sets },
                    ...(r2Sets
                        ? [{ id: "333oh-r2", scrambleSets: r2Sets }]
                        : []),
                ],
            },
        ],
    }) as unknown as Competition;

/** A 4-competitor bracket, final to 2 sets: 1 + 1 + 1 + 3 rows */
const plan = [
    { matchLabel: "Semifinal 1", setNumber: 1 },
    { matchLabel: "Semifinal 2", setNumber: 1 },
    { matchLabel: "Third-place match", setNumber: 1 },
    { matchLabel: "Final", setNumber: 1 },
    { matchLabel: "Final", setNumber: 2 },
    { matchLabel: "Final", setNumber: 3 },
];

describe("validateScrambles for a head-to-head round", () => {
    it("warns when fewer sets are imported than the plan needs, listing the rest", () => {
        const { warnings, errors } = validateScrambles(
            scramblesFile([set(), set()], [set(), set(), set(), set()]),
            competition(),
            false,
            { "333oh-r2": plan }
        );

        expect(errors).toEqual([]);
        expect(warnings).toEqual([
            "There are 4 scramble sets for 3x3x3 One-Handed, Round 2 but its bracket plans 6. These have no set yet: Final set 2, Final set 3",
        ]);
    });

    it("leaves out the usual set-count and scrambles-per-set warnings", () => {
        const { warnings } = validateScrambles(
            scramblesFile([set(), set()], [set(7, 3), set(7, 3)]),
            competition(),
            false,
            { "333oh-r2": plan.slice(0, 2) }
        );

        expect(warnings).toEqual([]);
    });

    it("still warns about set counts in the other rounds", () => {
        const { warnings } = validateScrambles(
            scramblesFile([set()], [set(), set()]),
            competition(),
            false,
            { "333oh-r2": plan.slice(0, 2) }
        );

        expect(warnings).toEqual([
            "There are 1 scramble sets for 3x3x3 One-Handed, Round 1 but 2 were expected",
        ]);
    });

    it("warns about a set with fewer than 5 normal scrambles", () => {
        const { warnings } = validateScrambles(
            scramblesFile([set(), set()], [set(), set(4, 4)]),
            competition(),
            false,
            { "333oh-r2": plan.slice(0, 2) }
        );

        expect(warnings).toEqual([
            "3x3x3 One-Handed, Round 2 Set B has 4 scrambles, fewer than 5, so a set that goes to 3–2 would use its extras",
        ]);
    });

    it("refuses a head-to-head round with no sets at all", () => {
        const { errors } = validateScrambles(
            scramblesFile([set(), set()], []),
            competition(),
            false,
            { "333oh-r2": plan }
        );

        expect(errors).toEqual([
            "There are no scramble sets for 3x3x3 One-Handed, Round 2",
        ]);
    });

    it("checks the scrambles per set, but not the plan, when sets are added", () => {
        const { warnings } = validateScrambles(
            scramblesFile([], [set(3)]),
            competition(),
            true,
            { "333oh-r2": plan }
        );

        expect(warnings).toEqual([
            "3x3x3 One-Handed, Round 2 Set A has 3 scrambles, fewer than 5, so a set that goes to 3–2 would use its extras",
        ]);
    });

    it("checks without a plan when the round has no bracket yet", () => {
        const { warnings } = validateScrambles(
            scramblesFile([set(), set()], [set()]),
            competition()
        );

        expect(warnings).toEqual([]);
    });
});
