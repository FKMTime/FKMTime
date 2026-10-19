import { describe, expect, it } from "vitest";
import { Competition } from "wcif-helpers";

import { Attempt, AttemptStatus, AttemptType, Result } from "@/lib/interfaces";
import { attemptValue, rankResults } from "@/lib/ranking";
import { getCheckTypes } from "@/lib/resultChecks";
import { getCutoffValue, getRoundMeta } from "@/lib/roundInfo";

let id = 0;
const attempt = (value: number, penalty = 0): Attempt =>
    ({
        id: `a${id++}`,
        attemptNumber: id,
        value,
        penalty,
        type: AttemptType.STANDARD_ATTEMPT,
        status: AttemptStatus.STANDARD,
        replacedBy: null,
    }) as unknown as Attempt;

const result = (name: string, values: [number, number?][]): Result =>
    ({
        id: name,
        person: { name },
        attempts: values.map(([v, p]) => attempt(v, p)),
    }) as unknown as Result;

describe("attemptValue", () => {
    it("adds +2 and treats DNF and DNS as worst", () => {
        expect(attemptValue(attempt(1000, 2))).toBe(1200);
        expect(attemptValue(attempt(0, -1))).toBe(Infinity);
        expect(attemptValue(attempt(0, -2))).toBe(Infinity);
    });
});

describe("rankResults", () => {
    it("ranks averages, then DNF averages, then incomplete, then empty", () => {
        const rows = rankResults(
            [
                result("Incomplete", [[900], [900]]),
                result("Empty", []),
                result("Slow", [[1500], [1500], [1500], [1500], [1500]]),
                result("DNF average", [[800], [0, -1], [0, -1], [800], [800]]),
                result("Fast", [[1000], [1000], [1000], [1000], [1000]]),
            ],
            5,
            "a"
        );
        expect(rows.map((r) => r.result.person.name)).toEqual([
            "Fast",
            "Slow",
            "DNF average",
            "Incomplete",
            "Empty",
        ]);
        expect(rows.map((r) => r.position)).toEqual([1, 2, 3, 4, null]);
    });

    it("shares positions between ties", () => {
        const same: [number][] = [[1000], [1000], [1000]];
        const rows = rankResults(
            [
                result("B", same),
                result("A", same),
                result("C", [[2000], [2000], [2000]]),
            ],
            3,
            "m"
        );
        expect(rows.map((r) => [r.result.person.name, r.position])).toEqual([
            ["A", 1],
            ["B", 1],
            ["C", 3],
        ]);
    });

    it("ranks best-of formats by single", () => {
        const rows = rankResults(
            [
                result("Slow", [[3000], [0, -1], [2900]]),
                result("Fast", [[0, -1], [2500], [0, -1]]),
            ],
            3,
            "3"
        );
        expect(rows.map((r) => r.result.person.name)).toEqual(["Fast", "Slow"]);
    });
});

describe("round info", () => {
    it("reads either cutoff field name", () => {
        expect(
            getCutoffValue({ numberOfAttempts: 2, attemptResult: 1200 })
        ).toBe(1200);
        expect(getCutoffValue({ numberOfAttempts: 2, resultValue: 900 })).toBe(
            900
        );
    });

    it("describes format, limit and cutoff", () => {
        const wcif = {
            events: [
                {
                    id: "333",
                    rounds: [
                        {
                            id: "333-r1",
                            format: "a",
                            timeLimit: {
                                centiseconds: 60000,
                                cumulativeRoundIds: [],
                            },
                            cutoff: {
                                numberOfAttempts: 2,
                                attemptResult: 1200,
                            },
                        },
                    ],
                },
            ],
        } as unknown as Competition;
        expect(getRoundMeta("333-r1", wcif)).toEqual({
            format: "Average of 5",
            timeLimit: "10:00.00",
            cutoff: "12.00 (2 attempts)",
        });
        expect(getRoundMeta("444-r1", wcif)).toBeNull();
    });
});

describe("getCheckTypes", () => {
    it("classifies why an attempt was flagged", () => {
        expect(
            getCheckTypes({
                ...attempt(1000, 4),
                inspectionTime: 16000,
                fastAttemptRatio: 0.4,
            } as Attempt)
        ).toEqual(["inspection", "penalty", "fast"]);
        expect(getCheckTypes(attempt(0, -2))).toEqual(["dns"]);
    });
});
