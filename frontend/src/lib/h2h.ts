import { Result } from "./interfaces";
import { queryFamily, setQueryData } from "./queryCache";
import { queryClient } from "./queryClient";
import { attemptValue, RankedResult } from "./ranking";
import { backendQuery, backendRequest } from "./request";
import { getSubmittedAttempts } from "./utils";

/**
 * Head-to-head rounds (SPEC-001): a bracket of matches the backend builds,
 * seeds and scores. The panel only shows what it returns and sends changes.
 */

export type H2hStage =
    | "STAGE_OF_16"
    | "STAGE_OF_12"
    | "QUARTERFINAL"
    | "SEMIFINAL"
    | "THIRD_PLACE"
    | "FINAL";

export type H2hBracketStatus = "DRAFT" | "SEEDED" | "IN_PROGRESS" | "FINISHED";
export type H2hMatchStatus = "WAITING" | "READY" | "IN_PROGRESS" | "FINISHED";

export const BRACKET_SIZES = [4, 8, 12, 16] as const;
export const MAX_SETS_TO_WIN = 3;

/** How the stages are named to people (I2a) */
export const STAGE_LABELS: Record<H2hStage, string> = {
    STAGE_OF_16: "Stage of 16",
    STAGE_OF_12: "Stage of 12",
    QUARTERFINAL: "Quarterfinal",
    SEMIFINAL: "Semifinal",
    THIRD_PLACE: "Third-place match",
    FINAL: "Final",
};

export const MATCH_STATUS_LABELS: Record<H2hMatchStatus, string> = {
    WAITING: "Waiting",
    READY: "Ready",
    IN_PROGRESS: "Playing",
    FINISHED: "Done",
};

export interface H2hPerson {
    id: string;
    name: string;
    wcaId: string | null;
    registrantId: number | null;
    countryIso2: string | null;
}

export interface H2hEntrant {
    id: string;
    seed: number;
    seedTieBroken: boolean;
    withdrawnAt: string | null;
    /** The match they withdrew or retired from */
    withdrawnInMatchId?: string | null;
    person: H2hPerson;
    /** WCA-encoded best single of the round; null with no attempt yet */
    bestSingle: number | null;
    /** Final position (9f16b); null while still in play or with no attempt */
    position: number | null;
    /** The stage of the last match they are in */
    stageReached: H2hStage | null;
}

export type H2hSideName = "A" | "B";

export type H2hSetDecision =
    | "POINTS"
    | "MOST_POINTS"
    | "BEST_IN_SET"
    | "BEST_IN_MATCH"
    | "BEST_IN_ROUND"
    | "SEED";

/** How a set was decided, in plain words (I3b, I3e) */
export const SET_DECISION_TEXT: Record<H2hSetDecision, string> = {
    POINTS: "Won on points",
    MOST_POINTS: "Won on more points after 7",
    BEST_IN_SET: "Won on the better single in the set",
    BEST_IN_MATCH: "Won on the better single in the match",
    BEST_IN_ROUND: "Won on the better singles in the round",
    SEED: "Won on the higher seed",
};

export interface H2hPointAttempt {
    id: string;
    attemptNumber: number;
    value: number;
    penalty: number;
}

export interface H2hPoint {
    id: string;
    pointNumber: number;
    /** Null when decided with no winner (I3d), or while not decided */
    winnerSide: H2hSideName | null;
    decided: boolean;
    attemptA: H2hPointAttempt | null;
    attemptB: H2hPointAttempt | null;
    /** Races replaced by Extra granted, oldest first (11k1) */
    extras?: { attemptA: H2hPointAttempt; attemptB: H2hPointAttempt }[];
    /** A time changed after the match, which kept its winner (11l1) */
    amendedAfterMatch?: boolean;
    scramble: { set: string; num: number; isExtra: boolean } | null;
}

export interface H2hSet {
    setNumber: number;
    winnerSide: H2hSideName | null;
    decidedBy: H2hSetDecision | null;
    scrambleSet: { id: string; set: string } | null;
    points: H2hPoint[];
}

export interface H2hSide {
    entrantId: string | null;
    /** Filled from an earlier match: its winner or its loser */
    source: { matchNumber: number; outcome: "WINNER" | "LOSER" } | null;
}

/** How a finished match ended */
export type H2hMatchEnd = "PLAYED" | "WALKOVER" | "RETIRED";

/** What a delegate did to a match besides its points, and why */
export interface H2hMatchLogEntry {
    action: "WITHDRAW" | "RETIRE" | "REOPEN";
    side: H2hSideName | null;
    comment: string | null;
    createdAt: string;
    createdBy: string | null;
}

export interface H2hMatch {
    id: string;
    matchNumber: number;
    /** "Quarterfinal 2", or "Final" */
    label: string;
    stage: H2hStage;
    setsToWin: number;
    status: H2hMatchStatus;
    winnerSide: H2hSideName | null;
    endedBy?: H2hMatchEnd | null;
    log?: H2hMatchLogEntry[];
    /** Why Reopen match would be refused; null when it can be reopened */
    reopenRefusal?: string | null;
    sideA: H2hSide;
    sideB: H2hSide;
    /** Sets won by each side */
    score: { a: number; b: number };
    sets: H2hSet[];
    /**
     * For the playing match: the scramble its next point races, e.g.
     * "Quarterfinal 3 · set 1 · Set C, scramble 4", and what the scramble
     * team must know (a spare set in use, none left)
     */
    scrambleInUse: {
        pointNumber: number;
        text: string;
        warning: string | null;
    } | null;
}

export interface H2hStageSetup {
    stage: H2hStage;
    label: string;
    setsToWin: number;
    started: boolean;
}

export interface H2hBracket {
    id: string;
    size: number;
    status: H2hBracketStatus;
    wcaRoundId: number | null;
    seedsLocked: boolean;
    attemptsLinked: boolean;
    stages: H2hStageSetup[];
    entrants: H2hEntrant[];
    matches: H2hMatch[];
}

export interface H2hPlanRow {
    id: string;
    matchId: string;
    matchNumber: number;
    matchLabel: string;
    setNumber: number;
    scrambleSetId: string | null;
    /** Raced already, so its set can't change */
    locked: boolean;
}

export interface H2hScrambleSet {
    id: string;
    set: string;
    scramblesCount: number;
    extraScramblesCount: number;
    raced: boolean;
}

export interface H2hScramblePlan {
    plannedSets: number;
    /** What to set on the WCA website and generate in TNoodle */
    instruction: string;
    rows: H2hPlanRow[];
    scrambleSets: H2hScrambleSet[];
}

export interface H2hRoundView {
    roundId: string;
    eventId: string;
    /** Why the round can't have a bracket, e.g. a cumulative time limit */
    cannotCreate: string | null;
    /** The previous round's top N, when that is a bracket size */
    suggestedSize: number | null;
    /** People who can be put in the bracket by hand */
    candidates: H2hPerson[];
    bracket: H2hBracket | null;
    scramblePlan: H2hScramblePlan | null;
    /** After creating: what the seeds still need from the delegate */
    notice?: string | null;
}

/** A round's bracket, with its setup and scramble plan */
export const h2hRoundQuery = queryFamily((roundId) =>
    backendQuery<H2hRoundView>(`h2h/${roundId}`)
);

/** Refetches the round's bracket, e.g. after an attempt was entered */
export const invalidateH2hRound = (roundId: string) =>
    queryClient.invalidateQueries({ queryKey: [h2hRoundQuery(roundId).key] });

/** The stages a bracket of this size plays, in order */
export const getStages = (size: number): H2hStage[] => {
    const finalStage: H2hStage[] = ["THIRD_PLACE", "FINAL"];
    switch (size) {
        case 4:
            return ["SEMIFINAL", ...finalStage];
        case 8:
            return ["QUARTERFINAL", "SEMIFINAL", ...finalStage];
        case 12:
            return ["STAGE_OF_12", "QUARTERFINAL", "SEMIFINAL", ...finalStage];
        case 16:
            return ["STAGE_OF_16", "QUARTERFINAL", "SEMIFINAL", ...finalStage];
        default:
            return [];
    }
};

export type SetsToWin = Partial<Record<H2hStage, number>>;

/** Every stage at 1 set to win, the default for a new bracket */
export const defaultSetsToWin = (size: number): SetsToWin =>
    Object.fromEntries(getStages(size).map((stage) => [stage, 1]));

/**
 * What's wrong with these sets to win, as the backend words it (I3a1,
 * I3a2): no stage lower than the one before, the final at least the
 * third-place match. Checked here so the form explains before saving.
 */
export const validateSetsToWin = (size: number, setsToWin: SetsToWin) => {
    const errors: string[] = [];
    let previous: { stage: H2hStage; value: number } | null = null;
    for (const stage of getStages(size)) {
        const value = setsToWin[stage];
        if (
            value === undefined ||
            !Number.isInteger(value) ||
            value < 1 ||
            value > MAX_SETS_TO_WIN
        ) {
            errors.push(
                `Sets to win in the ${STAGE_LABELS[stage]} must be between 1 and ${MAX_SETS_TO_WIN}`
            );
            continue;
        }
        if (previous !== null && value < previous.value) {
            errors.push(
                `Sets to win in the ${STAGE_LABELS[stage]} can't be lower than in the ${STAGE_LABELS[previous.stage]}`
            );
        }
        previous = { stage, value };
    }
    return errors;
};

/** The competitor's name, or "Winner of Quarterfinal 2" while unknown */
export const sideLabel = (
    side: H2hSide,
    bracket: Pick<H2hBracket, "entrants" | "matches">
) => {
    const entrant = bracket.entrants.find((e) => e.id === side.entrantId);
    if (entrant) return entrant.person.name;
    if (side.source) {
        const from = bracket.matches.find(
            (m) => m.matchNumber === side.source?.matchNumber
        );
        const outcome = side.source.outcome === "WINNER" ? "Winner" : "Loser";
        return `${outcome} of ${from?.label ?? `match ${side.source.matchNumber}`}`;
    }
    return "Not seeded yet";
};

interface MutationResult {
    ok: boolean;
    view?: H2hRoundView;
    message?: string;
}

const send = async (
    roundId: string,
    path: string,
    method: string,
    body?: unknown
): Promise<MutationResult> => {
    // Venue Wi-Fi drops: say so instead of leaving the button waiting
    const response = await backendRequest(path, method, true, body).catch(
        () => null
    );
    if (!response) {
        return {
            ok: false,
            message:
                "Couldn't reach FKMTime. Check the connection and try again.",
        };
    }
    if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message = data?.message;
        return {
            ok: false,
            message: Array.isArray(message)
                ? message.join(". ")
                : message ?? "Something went wrong",
        };
    }
    if (response.status === 204) {
        setQueryData<H2hRoundView | undefined>(
            h2hRoundQuery(roundId).key,
            (previous) =>
                previous && { ...previous, bracket: null, scramblePlan: null }
        );
        return { ok: true };
    }
    const view: H2hRoundView = await response.json();
    setQueryData(h2hRoundQuery(roundId).key, view);
    return { ok: true, view };
};

export const createBracket = (
    roundId: string,
    body: { size: number; setsToWin: SetsToWin }
) => send(roundId, `h2h/${roundId}`, "POST", body);

export const updateSeeds = (roundId: string, personIds: string[]) =>
    send(roundId, `h2h/${roundId}/seeds`, "PUT", { personIds });

export const updateBracket = (
    roundId: string,
    body: {
        wcaRoundId?: number | null;
        setsToWin?: SetsToWin;
    }
) => send(roundId, `h2h/${roundId}`, "PUT", body);

export const startMatch = (roundId: string, matchId: string) =>
    send(roundId, `h2h/match/${matchId}/start`, "POST");

/** Extra granted on a point: both competitors race it again (11k1) */
export const grantExtra = (roundId: string, pointId: string, comment = "") =>
    send(roundId, `h2h/point/${pointId}/extra`, "POST", { comment });

/** A competitor withdraws before their match: a walkover (I2h) */
export const withdrawFromMatch = (
    roundId: string,
    matchId: string,
    side: H2hSideName,
    comment = ""
) => send(roundId, `h2h/match/${matchId}/withdraw`, "POST", { side, comment });

/** A competitor can't go on during their match: the opponent wins it */
export const retireFromMatch = (
    roundId: string,
    matchId: string,
    side: H2hSideName,
    comment: string
) => send(roundId, `h2h/match/${matchId}/retire`, "POST", { side, comment });

/** Decides a finished match again from its times as they are now */
export const reopenMatch = (
    roundId: string,
    matchId: string,
    comment: string
) => send(roundId, `h2h/match/${matchId}/reopen`, "POST", { comment });

/** Regulation 11k2, for whoever grants an extra on a point */
export const EXTRA_REMINDER =
    "Both competitors get an extra (Regulation 11k1). If the incident couldn't have changed who won the point, don't grant one (Regulation 11k2).";

/** Points each side has won in a set */
export const pointsWon = (set: Pick<H2hSet, "points">) => ({
    a: set.points.filter((point) => point.winnerSide === "A").length,
    b: set.points.filter((point) => point.winnerSide === "B").length,
});

export const deleteBracket = (roundId: string) =>
    send(roundId, `h2h/${roundId}`, "DELETE");

export const updateScramblePlan = (
    roundId: string,
    rows: { id: string; scrambleSetId: string | null }[]
) => send(roundId, `h2h/${roundId}/scrambles`, "PUT", { rows });

/**
 * The plan rows to send when a row gets this set: the set moves there, and
 * the row that had it takes this row's set instead, so two rows swap
 */
export const planRowChanges = (
    rows: H2hPlanRow[],
    rowId: string,
    scrambleSetId: string | null
) => {
    const row = rows.find((r) => r.id === rowId);
    if (!row || row.scrambleSetId === scrambleSetId) return [];
    const holder =
        scrambleSetId === null
            ? undefined
            : rows.find((r) => r.scrambleSetId === scrambleSetId);
    return [
        { id: row.id, scrambleSetId },
        ...(holder
            ? [{ id: holder.id, scrambleSetId: row.scrambleSetId }]
            : []),
    ];
};

export interface H2hRankedResult extends RankedResult {
    stageReached: H2hStage | null;
}

/**
 * The round's results in the order of the bracket's final ranking (9f16b),
 * which the backend works out: positions first, then everyone still in
 * play by best single. No average: head-to-head rounds have none.
 */
export const rankH2hResults = (
    results: Result[],
    entrants: H2hEntrant[]
): H2hRankedResult[] => {
    const best = (row: RankedResult) =>
        Math.min(Infinity, ...row.submitted.map(attemptValue));
    return results
        .map((result) => {
            const entrant = entrants.find(
                (e) => e.person.id === result.person.id
            );
            return {
                result,
                position: entrant?.position ?? null,
                submitted: getSubmittedAttempts(result.attempts),
                average: null,
                stageReached: entrant?.stageReached ?? null,
            };
        })
        .sort(
            (x, y) =>
                (x.position ?? Infinity) - (y.position ?? Infinity) ||
                best(x) - best(y) ||
                x.result.person.name.localeCompare(y.result.person.name)
        );
};
