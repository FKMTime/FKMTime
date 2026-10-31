import { describe, expect, it } from "vitest";
import { Competition } from "wcif-helpers";

import { AttemptType, Person } from "@/lib/interfaces";
import { AttemptStatus } from "@/lib/interfaces";
import {
    getAttemptOptions,
    getNextAttemptValue,
    getNumberOfAttempts,
    getQuickEntryRounds,
    matchCompetitors,
    parseQuickTime,
} from "@/lib/quickEntry";
import { reformatInput } from "@/lib/resultFormatters";

const wcif = {
    events: [
        { id: "333", rounds: [{ id: "333-r1", format: "a" }] },
        { id: "666", rounds: [{ id: "666-r1", format: "m" }] },
    ],
    persons: [
        { registrantId: 1, registration: { eventIds: ["333"] } },
        { registrantId: 2, registration: { eventIds: ["333", "666"] } },
        { registrantId: 3, registration: { eventIds: ["666"] } },
        { registrantId: 4, registration: { eventIds: ["333"] } },
    ],
} as unknown as Competition;

const person = (registrantId: number, name: string, canCompete = true) =>
    ({ id: `p${registrantId}`, registrantId, name, canCompete }) as Person;

const persons = [
    person(1, "Anna Example"),
    person(2, "Jan Sample"),
    person(3, "Anna Other"),
    person(4, "Annabel Test", false),
];

describe("quick entry", () => {
    it("offers the round's attempts and two extras", () => {
        expect(getNumberOfAttempts("666-r1", wcif)).toBe(3);
        const options = getAttemptOptions(getNumberOfAttempts("666-r1", wcif));
        expect(options.map((o) => o.value)).toEqual([
            "1",
            "2",
            "3",
            "E1",
            "E2",
        ]);
        expect(options[3]).toMatchObject({
            attemptNumber: 1,
            type: AttemptType.EXTRA_ATTEMPT,
        });
    });

    it("matches registered competitors by name or registrant ID", () => {
        expect(
            matchCompetitors(persons, wcif, "333", "anna").map((p) => p.name)
        ).toEqual(["Anna Example"]);
        expect(
            matchCompetitors(persons, wcif, "666", "2").map((p) => p.name)
        ).toEqual(["Jan Sample"]);
        expect(matchCompetitors(persons, wcif, "333", " ")).toEqual([]);
    });

    it("parses typed digits into centiseconds", () => {
        expect(parseQuickTime(reformatInput("984"))).toBe(984);
        expect(parseQuickTime(reformatInput("10231"))).toBe(6231);
        expect(parseQuickTime("")).toBeNull();
        expect(parseQuickTime("9:99.99")).toBeNull();
    });

    it("lists rounds in progress with the rooms and groups running them", () => {
        expect(
            getQuickEntryRounds([
                { name: "Main room", currentGroupIds: ["333-r1-g2"] },
                {
                    name: "Side room",
                    currentGroupIds: ["333-r1-g3", "pyram-r1-g1"],
                },
            ])
        ).toEqual([
            {
                roundId: "333-r1",
                meta: "Main room · Group 2, Side room · Group 3",
            },
            { roundId: "pyram-r1", meta: "Side room · Group 1" },
        ]);
    });
});

describe("getAttemptOptions for a redo", () => {
    const waiting = (attemptNumber: number) => ({
        attemptNumber,
        type: AttemptType.STANDARD_ATTEMPT,
        status: AttemptStatus.EXTRA_GIVEN,
        replacedBy: null,
    });
    const extras = (options: { value: string }[]) =>
        options.map((o) => o.value).filter((v) => v.startsWith("E"));

    it("offers an extra for every attempt waiting for a redo", () => {
        expect(
            extras(getAttemptOptions(5, [1, 2, 3, 4, 5].map(waiting)))
        ).toEqual(["E1", "E2", "E3", "E4", "E5"]);
    });

    it("keeps extras that already exist", () => {
        const extra = { attemptNumber: 4, type: AttemptType.EXTRA_ATTEMPT };
        expect(extras(getAttemptOptions(5, [extra]))).toEqual([
            "E1",
            "E2",
            "E3",
            "E4",
        ]);
    });
});

describe("getNextAttemptValue", () => {
    const options = getAttemptOptions(5);
    const standard = (attemptNumber: number) => ({
        attemptNumber,
        type: AttemptType.STANDARD_ATTEMPT,
    });
    const extra = (attemptNumber: number) => ({
        attemptNumber,
        type: AttemptType.EXTRA_ATTEMPT,
    });

    it("starts at attempt 1 without attempts", () => {
        expect(getNextAttemptValue(options, [])).toBe("1");
    });

    it("picks the first missing standard attempt", () => {
        expect(getNextAttemptValue(options, [standard(1), standard(2)])).toBe(
            "3"
        );
        expect(getNextAttemptValue(options, [standard(1), standard(3)])).toBe(
            "2"
        );
    });

    it("moves on to unused extras once every standard attempt exists", () => {
        const all = [1, 2, 3, 4, 5].map(standard);
        expect(getNextAttemptValue(options, all)).toBe("E1");
        expect(getNextAttemptValue(options, [...all, extra(1)])).toBe("E2");
    });

    it("goes to the next extra while attempts wait for a redo", () => {
        const waiting = {
            ...standard(1),
            status: AttemptStatus.EXTRA_GIVEN,
            replacedBy: null,
        };
        expect(getNextAttemptValue(options, [waiting, standard(2)])).toBe("E1");
        expect(
            getNextAttemptValue(options, [waiting, standard(2), extra(1)])
        ).toBe("E2");
    });

    it("falls back to attempt 1 when everything is taken", () => {
        const all = [...[1, 2, 3, 4, 5].map(standard), extra(1), extra(2)];
        expect(getNextAttemptValue(options, all)).toBe("1");
    });
});
