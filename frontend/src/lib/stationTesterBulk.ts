import { Competition as WCIF, Round } from "wcif-helpers";

import { Person, Result } from "./interfaces";
import { buildAttemptPacket, StationExchange } from "./stationTester";

/** Returns a number in [0, 1), like Math.random */
export type Rng = () => number;

/** A seeded RNG, so a fill (or a test) can be repeated exactly */
export const seededRng = (seed: number): Rng => {
    let state = seed >>> 0;
    return () => {
        // mulberry32
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

/** Rough mean of a competitor's solve, in ms */
export const EVENT_MEAN_MS: Record<string, number> = {
    "222": 5_000,
    "333": 12_000,
    "444": 45_000,
    "555": 90_000,
    "666": 170_000,
    "777": 250_000,
    "333oh": 20_000,
    clock: 10_000,
    minx: 80_000,
    pyram: 6_000,
    skewb: 6_000,
    sq1: 20_000,
};

/** For unofficial events, whose times nobody can guess */
export const FALLBACK_MEAN_MS = 15_000;

/** One competitor is faster or slower than another by this much of the mean */
const SPREAD = 0.2;
const MIN_FACTOR = 0.4;
const MAX_FACTOR = 2.5;

const SKIPPED_EVENTS: Record<string, string> = {
    "333bf": "3x3x3 Blindfolded",
    "444bf": "4x4x4 Blindfolded",
    "555bf": "5x5x5 Blindfolded",
    "333mbf": "3x3x3 Multi-Blind",
    "333fm": "3x3x3 Fewest Moves",
};

export const DNF_PENALTY = -1;
export const PLUS_TWO_PENALTY = 2;

export interface PenaltyOdds {
    /** Percent chance of a +2, 0-100 */
    plusTwoPercent: number;
    /** Percent chance of a DNF, 0-100 */
    dnfPercent: number;
}

export const DEFAULT_PENALTY_ODDS: PenaltyOdds = {
    plusTwoPercent: 5,
    dnfPercent: 2,
};

export interface PlannedAttempt {
    timeMs: number;
    /** 0, 2 (+2) or -1 (DNF), as a station sends it */
    penalty: number;
    inspectionTimeMs: number;
}

/** What a round asks for, from its WCIF */
export interface RoundRules {
    attempts: number;
    cutoff: { numberOfAttempts: number; centiseconds: number } | null;
    /** Per attempt; the backend turns a slower attempt into a DNF */
    timeLimitCs: number | null;
    /** Across the round, when the limit is cumulative */
    cumulativeLimitCs: number | null;
}

const FORMAT_ATTEMPTS: Record<string, number> = {
    "1": 1,
    "2": 2,
    "3": 3,
    "5": 5,
    a: 5,
    m: 3,
};

/** Attempts the format asks for, as the backend counts them; null for head-to-head */
export const getFormatAttempts = (format: string): number | null =>
    FORMAT_ATTEMPTS[format] ?? null;

/** Why this round can't be filled, or null if it can */
export const getUnfillableReason = (round: Pick<Round, "id" | "format">) => {
    const eventId = round.id.split("-")[0];
    if (SKIPPED_EVENTS[eventId])
        return `${SKIPPED_EVENTS[eventId]} isn't filled: made-up times for it would be nonsense. Enter its results by hand.`;
    if (getFormatAttempts(round.format) === null)
        return "Head-to-head rounds can't run on a single station.";
    return null;
};

export const getRoundRules = (round: Round): RoundRules => {
    const limit = round.timeLimit;
    const isCumulative = !!limit && limit.cumulativeRoundIds.length > 0;
    return {
        attempts: getFormatAttempts(round.format) ?? 0,
        cutoff: round.cutoff
            ? {
                  numberOfAttempts: round.cutoff.numberOfAttempts,
                  centiseconds: round.cutoff.resultValue,
              }
            : null,
        timeLimitCs:
            limit && !isCumulative && limit.centiseconds > 0
                ? limit.centiseconds
                : null,
        cumulativeLimitCs:
            limit && isCumulative && limit.centiseconds > 0
                ? limit.centiseconds
                : null,
    };
};

/** Standard normal, Box-Muller */
const normal = (rng: Rng) => {
    const u = Math.max(rng(), Number.EPSILON);
    const v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

export const getEventMeanMs = (eventId: string) =>
    EVENT_MEAN_MS[eventId] ?? FALLBACK_MEAN_MS;

/** The range generated times stay in, so tests can check against it */
export const getTimeRangeMs = (eventId: string) => {
    const mean = getEventMeanMs(eventId);
    return {
        min: Math.round(mean * MIN_FACTOR),
        max: Math.round(mean * MAX_FACTOR),
    };
};

/** A solve time around the event's mean, or around the competitor's own mean */
export const generateTimeMs = (eventId: string, rng: Rng, meanMs?: number) => {
    const mean = meanMs ?? getEventMeanMs(eventId);
    const { min, max } = getTimeRangeMs(eventId);
    // Solves of one competitor vary less than competitors do
    const time = mean * (1 + normal(rng) * (meanMs ? SPREAD / 2 : SPREAD));
    return Math.round(Math.min(max, Math.max(min, time)));
};

export const pickPenalty = (odds: PenaltyOdds, rng: Rng) => {
    const roll = rng() * 100;
    if (roll < odds.dnfPercent) return DNF_PENALTY;
    if (roll < odds.dnfPercent + odds.plusTwoPercent) return PLUS_TWO_PENALTY;
    return 0;
};

/** What the backend stores: centiseconds, cut down from the ms the station sends */
const toCentiseconds = (timeMs: number) => Math.floor(timeMs / 10);

/** The penalty the backend ends up with: a time over the limit is a DNF */
export const getEffectivePenalty = (
    attempt: PlannedAttempt,
    rules: Pick<RoundRules, "timeLimitCs">
) =>
    rules.timeLimitCs !== null &&
    toCentiseconds(attempt.timeMs) >= rules.timeLimitCs
        ? DNF_PENALTY
        : attempt.penalty;

/** Whether the attempts so far make the cutoff, the way the backend checks it */
export const madeCutoff = (
    attempts: PlannedAttempt[],
    rules: Pick<RoundRules, "cutoff" | "timeLimitCs">
) => {
    if (!rules.cutoff) return true;
    return attempts.slice(0, rules.cutoff.numberOfAttempts).some((attempt) => {
        const penalty = getEffectivePenalty(attempt, rules);
        if (penalty === DNF_PENALTY) return false;
        const result =
            toCentiseconds(attempt.timeMs) + (penalty > 0 ? penalty * 100 : 0);
        return result < rules.cutoff!.centiseconds;
    });
};

/**
 * One competitor's attempts: all the format asks for, or only the cutoff
 * attempts when they miss the cutoff, as a station at the venue would enter
 * them.
 */
export const planCompetitorAttempts = (
    eventId: string,
    rules: RoundRules,
    odds: PenaltyOdds,
    rng: Rng
): PlannedAttempt[] => {
    const competitorMean = generateTimeMs(eventId, rng);
    // Keep a cumulative limit from turning the rest of the round into DNS
    const cumulativeCap =
        rules.cumulativeLimitCs !== null && rules.attempts > 0
            ? Math.floor(
                  ((rules.cumulativeLimitCs * 10) / rules.attempts) * 0.9
              )
            : Infinity;
    const attempts: PlannedAttempt[] = [];
    for (let i = 1; i <= rules.attempts; i++) {
        attempts.push({
            timeMs: Math.min(
                cumulativeCap,
                generateTimeMs(eventId, rng, competitorMean)
            ),
            penalty: pickPenalty(odds, rng),
            inspectionTimeMs: 4_000 + Math.round(rng() * 8_000),
        });
        if (
            rules.cutoff &&
            i === rules.cutoff.numberOfAttempts &&
            !madeCutoff(attempts, rules)
        )
            break;
    }
    return attempts;
};

export interface FillJob {
    person: Person;
    groupId: string;
    attempts: PlannedAttempt[];
}

export interface FillPlan {
    jobs: FillJob[];
    skipped: { name: string; reason: string }[];
    totalAttempts: number;
}

const groupNumber = (groupId: string) => Number(groupId.split("-g")[1]);

/** The round's groups across every venue and room, as WCIF activity ids per group */
export const getRoundGroups = (wcif: WCIF, roundId: string) => {
    const groups = new Map<string, number[]>();
    for (const venue of wcif.schedule?.venues ?? []) {
        for (const room of venue.rooms) {
            for (const activity of room.activities) {
                if (activity.activityCode !== roundId) continue;
                for (const child of activity.childActivities ?? []) {
                    const ids = groups.get(child.activityCode) ?? [];
                    groups.set(child.activityCode, [...ids, child.id]);
                }
            }
        }
    }
    return [...groups.entries()]
        .sort(([a], [b]) => groupNumber(a) - groupNumber(b))
        .map(([groupId, activityIds]) => ({ groupId, activityIds }));
};

/**
 * Who competes in the group, or in each group of the round with a null
 * group: registrant id and their group, from the WCIF competitor assignments.
 * Without any assignments in the round, round 1 falls back to everyone
 * registered for the event, and later rounds to whoever has a result in it.
 */
export const getCompetitorsToFill = (
    wcif: WCIF,
    roundId: string,
    groupId: string | null,
    roundResults: Pick<Result, "person">[]
): { registrantId: number; groupId: string }[] => {
    const eventId = roundId.split("-")[0];
    const groups = getRoundGroups(wcif, roundId);
    const groupByActivity = new Map<number, string>();
    for (const group of groups)
        for (const id of group.activityIds)
            groupByActivity.set(id, group.groupId);

    const assigned = wcif.persons.flatMap((person) => {
        const assignment = person.assignments?.find(
            (a) =>
                a.assignmentCode === "competitor" &&
                groupByActivity.has(a.activityId)
        );
        return assignment
            ? [
                  {
                      registrantId: person.registrantId,
                      groupId: groupByActivity.get(assignment.activityId)!,
                  },
              ]
            : [];
    });
    if (groupId) return assigned.filter((a) => a.groupId === groupId);
    if (assigned.length > 0) return assigned;

    const fallbackGroupId = groups[0]?.groupId ?? `${roundId}-g1`;
    if (roundId.endsWith("-r1")) {
        return wcif.persons
            .filter(
                (person) =>
                    person.registration?.status === "accepted" &&
                    person.registration.eventIds.includes(eventId)
            )
            .map((person) => ({
                registrantId: person.registrantId,
                groupId: fallbackGroupId,
            }));
    }
    return roundResults
        .filter((result) => result.person.registrantId != null)
        .map((result) => ({
            registrantId: result.person.registrantId!,
            groupId: fallbackGroupId,
        }));
};

/**
 * Everything a fill will send, before anything is sent. Competitors who
 * already have attempts in the round are left alone: the backend would
 * number new ones after theirs and run out of attempts.
 */
export const planFill = ({
    wcif,
    roundId,
    groupId,
    persons,
    roundResults,
    odds,
    rng,
}: {
    wcif: WCIF;
    roundId: string;
    /** null for the whole round */
    groupId: string | null;
    persons: Person[];
    roundResults: Pick<Result, "person" | "attempts">[];
    odds: PenaltyOdds;
    rng: Rng;
}): FillPlan => {
    const round = wcif.events
        .flatMap((event) => event.rounds)
        .find((r) => r.id === roundId);
    if (!round) return { jobs: [], skipped: [], totalAttempts: 0 };
    const eventId = roundId.split("-")[0];
    const rules = getRoundRules(round);
    const byRegistrantId = new Map(
        persons
            .filter((p) => p.registrantId != null)
            .map((p) => [p.registrantId!, p])
    );
    const attemptsSoFar = new Map(
        roundResults.map((result) => [
            result.person.registrantId,
            result.attempts?.length ?? 0,
        ])
    );

    const plan: FillPlan = { jobs: [], skipped: [], totalAttempts: 0 };
    for (const competitor of getCompetitorsToFill(
        wcif,
        roundId,
        groupId,
        roundResults
    )) {
        const person = byRegistrantId.get(competitor.registrantId);
        if (!person) {
            const name =
                wcif.persons.find(
                    (p) => p.registrantId === competitor.registrantId
                )?.name ?? `Registrant ${competitor.registrantId}`;
            plan.skipped.push({ name, reason: "not in FKMTime" });
            continue;
        }
        const existing = attemptsSoFar.get(competitor.registrantId) ?? 0;
        if (existing > 0) {
            plan.skipped.push({
                name: person.name,
                reason: `already has ${existing} ${existing === 1 ? "attempt" : "attempts"}`,
            });
            continue;
        }
        const attempts = planCompetitorAttempts(eventId, rules, odds, rng);
        plan.jobs.push({ person, groupId: competitor.groupId, attempts });
        plan.totalAttempts += attempts.length;
    }
    return plan;
};

/**
 * The judge for each competitor: someone who isn't competing in the fill if
 * there is anyone, and a second person for the judge's own attempts.
 */
export const pickJudges = (persons: Person[], competitorIds: string[]) => {
    const competing = new Set(competitorIds);
    const sorted = [...persons].sort((a, b) => a.name.localeCompare(b.name));
    const primary =
        sorted.find((p) => !competing.has(p.id)) ?? sorted[0] ?? null;
    const backup = sorted.find((p) => p.id !== primary?.id) ?? null;
    return { primary, backup };
};

export interface FillProgress {
    sent: number;
    total: number;
}

export type FillOutcome =
    | { status: "done"; sent: number }
    | { status: "cancelled"; sent: number }
    | { status: "failed"; sent: number; exchange: StationExchange };

/**
 * Sends every planned attempt as an EnterAttempt packet, one at a time, and
 * stops at the first one the backend refuses, or when cancelled.
 */
export const runFill = async ({
    jobs,
    espId,
    getJudgeCard,
    send,
    newSessionId,
    signal,
    onProgress,
    now = () => new Date(),
}: {
    /** Each person must already have a card */
    jobs: FillJob[];
    espId: number;
    getJudgeCard: (competitor: Person) => string;
    send: (type: string, data: unknown) => Promise<StationExchange>;
    newSessionId: () => string;
    signal?: AbortSignal;
    onProgress?: (progress: FillProgress, exchange: StationExchange) => void;
    now?: () => Date;
}): Promise<FillOutcome> => {
    const total = jobs.reduce((sum, job) => sum + job.attempts.length, 0);
    let sent = 0;
    for (const job of jobs) {
        for (const attempt of job.attempts) {
            if (signal?.aborted) return { status: "cancelled", sent };
            const exchange = await send(
                "EnterAttempt",
                buildAttemptPacket(
                    {
                        timeMs: attempt.timeMs.toString(),
                        penalty: attempt.penalty,
                        inspectionTimeMs: attempt.inspectionTimeMs.toString(),
                        competitorCard: job.person.cardId ?? "",
                        judgeCard: getJudgeCard(job.person),
                        espId: espId.toString(),
                        groupId: job.groupId,
                        sessionId: newSessionId(),
                        solvedAt: "",
                        isDelegate: false,
                    },
                    now()
                )
            );
            if (exchange.failed) return { status: "failed", sent, exchange };
            sent++;
            onProgress?.({ sent, total }, exchange);
        }
    }
    return { status: "done", sent };
};
