import { describe, expect, it, vi } from "vitest";
import { Competition as WCIF, Round } from "wcif-helpers";

import { Person } from "../interfaces";
import { StationExchange } from "../stationTester";
import {
    DEFAULT_PENALTY_ODDS,
    DNF_PENALTY,
    FillJob,
    generateTimeMs,
    getCompetitorsToFill,
    getFormatAttempts,
    getRoundRules,
    getTimeRangeMs,
    getUnfillableReason,
    madeCutoff,
    pickJudges,
    pickPenalty,
    planCompetitorAttempts,
    planFill,
    PLUS_TWO_PENALTY,
    RoundRules,
    runFill,
    seededRng,
} from "../stationTesterBulk";

const round = (overrides: Partial<Round> = {}): Round =>
    ({
        id: "333-r1",
        format: "a",
        timeLimit: { centiseconds: 60000, cumulativeRoundIds: [] },
        cutoff: null,
        ...overrides,
    }) as Round;

const rules = (overrides: Partial<RoundRules> = {}): RoundRules => ({
    attempts: 5,
    cutoff: null,
    timeLimitCs: null,
    cumulativeLimitCs: null,
    ...overrides,
});

const NO_PENALTIES = { plusTwoPercent: 0, dnfPercent: 0 };

describe("round rules", () => {
    it.each([
        ["a", 5],
        ["5", 5],
        ["m", 3],
        ["3", 3],
        ["2", 2],
        ["1", 1],
    ])("format %s needs %i attempts", (format, attempts) => {
        expect(getFormatAttempts(format)).toBe(attempts);
        expect(
            getRoundRules(round({ format: format as Round["format"] }))
        ).toMatchObject({ attempts });
    });

    it("refuses head-to-head and the events made-up times don't fit", () => {
        expect(getUnfillableReason(round({ format: "h" }))).toMatch(
            /Head-to-head/
        );
        for (const id of ["333bf-r1", "333fm-r1", "333mbf-r1", "444bf-r1"]) {
            expect(getUnfillableReason(round({ id }))).toMatch(/isn't filled/);
        }
        expect(getUnfillableReason(round())).toBeNull();
    });

    it("reads the cutoff and tells a cumulative limit from a per-attempt one", () => {
        expect(
            getRoundRules(
                round({ cutoff: { numberOfAttempts: 2, resultValue: 1500 } })
            )
        ).toEqual({
            attempts: 5,
            cutoff: { numberOfAttempts: 2, centiseconds: 1500 },
            timeLimitCs: 60000,
            cumulativeLimitCs: null,
        });
        expect(
            getRoundRules(
                round({
                    timeLimit: {
                        centiseconds: 30000,
                        cumulativeRoundIds: ["333-r1"],
                    },
                })
            )
        ).toMatchObject({ timeLimitCs: null, cumulativeLimitCs: 30000 });
    });
});

describe("times", () => {
    it.each(["333", "222", "777", "minx", "unknown-event"])(
        "keeps %s times within the event's range",
        (eventId) => {
            const rng = seededRng(7);
            const { min, max } = getTimeRangeMs(eventId);
            for (let i = 0; i < 500; i++) {
                const time = generateTimeMs(eventId, rng);
                expect(time).toBeGreaterThanOrEqual(min);
                expect(time).toBeLessThanOrEqual(max);
            }
        }
    );

    it("centres 3x3 around 12 seconds and 2x2 around 5", () => {
        const average = (eventId: string) => {
            const rng = seededRng(42);
            let sum = 0;
            for (let i = 0; i < 2000; i++) sum += generateTimeMs(eventId, rng);
            return sum / 2000;
        };
        expect(average("333")).toBeGreaterThan(11_000);
        expect(average("333")).toBeLessThan(13_000);
        expect(average("222")).toBeGreaterThan(4_500);
        expect(average("222")).toBeLessThan(5_500);
    });

    it("repeats exactly with the same seed", () => {
        const plan = (seed: number) =>
            planCompetitorAttempts(
                "333",
                rules(),
                DEFAULT_PENALTY_ODDS,
                seededRng(seed)
            );
        expect(plan(3)).toEqual(plan(3));
        expect(plan(3)).not.toEqual(plan(4));
    });
});

describe("penalties", () => {
    it("hands out +2 and DNF at the asked rates", () => {
        const rng = seededRng(1);
        const counts = { [PLUS_TWO_PENALTY]: 0, [DNF_PENALTY]: 0, 0: 0 };
        const rolls = 20_000;
        for (let i = 0; i < rolls; i++)
            counts[pickPenalty({ plusTwoPercent: 10, dnfPercent: 5 }, rng)]++;
        expect(counts[PLUS_TWO_PENALTY] / rolls).toBeCloseTo(0.1, 1);
        expect(counts[DNF_PENALTY] / rolls).toBeCloseTo(0.05, 1);
    });

    it("gives none at 0% and always one at 100%", () => {
        const rng = seededRng(2);
        for (let i = 0; i < 200; i++) {
            expect(pickPenalty(NO_PENALTIES, rng)).toBe(0);
            expect(
                pickPenalty({ plusTwoPercent: 0, dnfPercent: 100 }, rng)
            ).toBe(DNF_PENALTY);
            expect(
                pickPenalty({ plusTwoPercent: 100, dnfPercent: 0 }, rng)
            ).toBe(PLUS_TWO_PENALTY);
        }
    });
});

describe("cutoff", () => {
    const cutoff = { numberOfAttempts: 2, centiseconds: 1000 };
    const attempt = (timeMs: number, penalty = 0) => ({
        timeMs,
        penalty,
        inspectionTimeMs: 5000,
    });

    it("counts a +2 and doesn't count a DNF, like the backend", () => {
        const r = rules({ cutoff });
        expect(madeCutoff([attempt(9_990), attempt(20_000)], r)).toBe(true);
        expect(madeCutoff([attempt(8_500, 2)], r)).toBe(false);
        expect(madeCutoff([attempt(7_000, 2)], r)).toBe(true);
        expect(madeCutoff([attempt(5_000, DNF_PENALTY)], r)).toBe(false);
        // The station's ms are cut down to centiseconds: 10.009 is 10.00
        expect(madeCutoff([attempt(10_009)], r)).toBe(false);
    });

    it("counts a time over the limit as a DNF", () => {
        expect(
            madeCutoff([attempt(5_000)], rules({ cutoff, timeLimitCs: 400 }))
        ).toBe(false);
    });

    it("stops after the cutoff attempts when the competitor misses it", () => {
        // 3x3 times never get under 4.8 s, so a 1-second cutoff is never made
        const missed = planCompetitorAttempts(
            "333",
            rules({ cutoff: { numberOfAttempts: 2, centiseconds: 100 } }),
            NO_PENALTIES,
            seededRng(5)
        );
        expect(missed).toHaveLength(2);

        // Nor ever over 30 s, so a 10-minute cutoff is always made
        const made = planCompetitorAttempts(
            "333",
            rules({ cutoff: { numberOfAttempts: 2, centiseconds: 60_000 } }),
            NO_PENALTIES,
            seededRng(5)
        );
        expect(made).toHaveLength(5);
    });

    it("keeps a cumulative limit from running out", () => {
        const attempts = planCompetitorAttempts(
            "666",
            rules({ attempts: 3, cumulativeLimitCs: 30_000 }),
            NO_PENALTIES,
            seededRng(9)
        );
        const totalCs = attempts.reduce((sum, a) => sum + a.timeMs / 10, 0);
        expect(totalCs).toBeLessThan(30_000);
    });
});

const wcifPerson = (
    registrantId: number,
    activityId: number | null,
    eventIds = ["333"]
) => ({
    registrantId,
    name: `Competitor ${registrantId}`,
    registration: { status: "accepted", eventIds },
    assignments:
        activityId === null
            ? []
            : [
                  {
                      activityId,
                      assignmentCode: "competitor",
                      stationNumber: null,
                  },
              ],
});

const makeWcif = (persons: ReturnType<typeof wcifPerson>[]) =>
    ({
        events: [
            {
                id: "333",
                rounds: [
                    round({
                        cutoff: { numberOfAttempts: 2, resultValue: 60_000 },
                    }),
                    round({ id: "333-r2", format: "a" }),
                ],
            },
            { id: "333bf", rounds: [round({ id: "333bf-r1", format: "3" })] },
        ],
        persons,
        schedule: {
            venues: [
                {
                    rooms: [
                        {
                            activities: [
                                {
                                    activityCode: "333-r1",
                                    childActivities: [
                                        { id: 11, activityCode: "333-r1-g1" },
                                        { id: 12, activityCode: "333-r1-g2" },
                                    ],
                                },
                            ],
                        },
                        {
                            // The same group in a second room
                            activities: [
                                {
                                    activityCode: "333-r1",
                                    childActivities: [
                                        { id: 21, activityCode: "333-r1-g1" },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        },
    }) as unknown as WCIF;

const person = (registrantId: number, cardId?: string): Person => ({
    id: `p${registrantId}`,
    registrantId,
    name: `Competitor ${registrantId}`,
    canCompete: true,
    gender: "o",
    cardId,
});

describe("who gets filled", () => {
    const wcif = makeWcif([
        wcifPerson(1, 11),
        wcifPerson(2, 21),
        wcifPerson(3, 12),
        wcifPerson(4, null),
    ]);

    it("takes a group's competitors from every room", () => {
        expect(getCompetitorsToFill(wcif, "333-r1", "333-r1-g1", [])).toEqual([
            { registrantId: 1, groupId: "333-r1-g1" },
            { registrantId: 2, groupId: "333-r1-g1" },
        ]);
    });

    it("takes every group of the round for the whole round", () => {
        expect(
            getCompetitorsToFill(wcif, "333-r1", null, []).map(
                (c) => c.registrantId
            )
        ).toEqual([1, 2, 3]);
    });

    it("falls back to the round's results when nobody is assigned", () => {
        expect(
            getCompetitorsToFill(wcif, "333-r2", null, [{ person: person(3) }])
        ).toEqual([{ registrantId: 3, groupId: "333-r2-g1" }]);
    });

    it("plans every competitor and skips who already has attempts or isn't in FKMTime", () => {
        const plan = planFill({
            wcif,
            roundId: "333-r1",
            groupId: null,
            persons: [person(1), person(3)],
            roundResults: [
                {
                    person: person(3),
                    attempts: [{} as never, {} as never],
                },
            ],
            odds: NO_PENALTIES,
            rng: seededRng(1),
        });
        expect(plan.jobs.map((job) => job.person.id)).toEqual(["p1"]);
        expect(plan.jobs[0].attempts).toHaveLength(5);
        expect(plan.totalAttempts).toBe(5);
        expect(plan.skipped).toEqual([
            { name: "Competitor 2", reason: "not in FKMTime" },
            { name: "Competitor 3", reason: "already has 2 attempts" },
        ]);
    });
});

describe("judges", () => {
    it("picks someone who isn't competing, and a backup for their own attempts", () => {
        const persons = [person(1), person(2), person(3)];
        expect(pickJudges(persons, ["p1", "p2"])).toEqual({
            primary: persons[2],
            backup: persons[0],
        });
    });

    it("still finds two judges when everyone competes", () => {
        const persons = [person(1), person(2)];
        const { primary, backup } = pickJudges(persons, ["p1", "p2"]);
        expect(primary?.id).toBe("p1");
        expect(backup?.id).toBe("p2");
    });
});

describe("runFill", () => {
    const job = (registrantId: number, attempts: number): FillJob => ({
        person: person(registrantId, `${registrantId}00`),
        groupId: "333-r1-g1",
        attempts: Array.from({ length: attempts }, () => ({
            timeMs: 12_345,
            penalty: 0,
            inspectionTimeMs: 5_000,
        })),
    });
    const exchange = (failed: boolean): StationExchange => ({
        sent: { type: "EnterAttempt", data: {} },
        reply: { data: { message: failed ? "Refused" : "OK" } },
        failed,
    });

    it("sends every attempt as a station would, reporting progress", async () => {
        const send = vi.fn().mockResolvedValue(exchange(false));
        const onProgress = vi.fn();
        let session = 0;

        const outcome = await runFill({
            jobs: [job(1, 2), job(2, 1)],
            espId: 4321,
            getJudgeCard: () => "999",
            send,
            newSessionId: () => `s${++session}`,
            onProgress,
            now: () => new Date("2026-01-01T10:00:00Z"),
        });

        expect(outcome).toEqual({ status: "done", sent: 3 });
        expect(send).toHaveBeenCalledTimes(3);
        expect(send.mock.calls[2]).toEqual([
            "EnterAttempt",
            {
                value: 1234,
                valueMs: 12345,
                penalty: 0,
                inspectionTime: 5000,
                solvedAt: "2026-01-01T10:00:00.000Z",
                espId: 4321,
                judgeId: 999,
                competitorId: 200,
                isDelegate: false,
                sessionId: "s3",
                groupId: "333-r1-g1",
            },
        ]);
        expect(onProgress).toHaveBeenLastCalledWith(
            { sent: 3, total: 3 },
            expect.anything()
        );
    });

    it("stops at the first refused attempt", async () => {
        const refused = exchange(true);
        const send = vi
            .fn()
            .mockResolvedValueOnce(exchange(false))
            .mockResolvedValueOnce(refused);

        const outcome = await runFill({
            jobs: [job(1, 5)],
            espId: 1,
            getJudgeCard: () => "999",
            send,
            newSessionId: () => "s",
        });

        expect(outcome).toEqual({
            status: "failed",
            sent: 1,
            exchange: refused,
        });
        expect(send).toHaveBeenCalledTimes(2);
    });

    it("stops when cancelled", async () => {
        const controller = new AbortController();
        const send = vi.fn().mockImplementation(async () => {
            controller.abort();
            return exchange(false);
        });

        const outcome = await runFill({
            jobs: [job(1, 5)],
            espId: 1,
            getJudgeCard: () => "999",
            send,
            newSessionId: () => "s",
            signal: controller.signal,
        });

        expect(outcome).toEqual({ status: "cancelled", sent: 1 });
    });
});
