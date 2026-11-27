import { DNF_VALUE, DNS_VALUE } from "./constants";
import {
    H2hBracketStatus,
    H2hMatchEnd,
    H2hMatchStatus,
    H2hSetDecision,
    H2hSide,
    H2hSideName,
    H2hStage,
} from "./h2h";
import { StationInfo } from "./liveSolving";
import { queryFamily } from "./queryCache";
import { backendQuery } from "./request";
import { resultToString } from "./resultFormatters";

/**
 * Head-to-head rounds for spectators (SPEC-001): the bracket, a match's
 * scoreboard and the TV slides, read from `GET /h2h/public/:roundId`.
 * The backend scores and ranks; these only lay it out.
 */

/** A competitor's time on a point: centiseconds, penalty in seconds */
export interface PublicH2hAttempt {
    value: number;
    /** Seconds added, -1 for DNF, -2 for DNS */
    penalty: number;
}

export interface PublicH2hPoint {
    pointNumber: number;
    /** Null when decided with no winner (I3d), or while not decided */
    winnerSide: H2hSideName | null;
    decided: boolean;
    a: PublicH2hAttempt | null;
    b: PublicH2hAttempt | null;
    /** Raced again on a fresh scramble (11k1) */
    extraGranted: boolean;
}

export interface PublicH2hSet {
    setNumber: number;
    winnerSide: H2hSideName | null;
    decidedBy: H2hSetDecision | null;
    points: PublicH2hPoint[];
}

export interface PublicH2hEntrant {
    id: string;
    seed: number;
    name: string;
    countryIso2: string | null;
    /** The number stations report, to find their timers */
    registrantId: number | null;
    bestSingle: number | null;
    position: number | null;
    stageReached: H2hStage | null;
}

export interface PublicH2hMatch {
    id: string;
    matchNumber: number;
    /** "Quarterfinal 2", or "Final" */
    label: string;
    stage: H2hStage;
    setsToWin: number;
    status: H2hMatchStatus;
    winnerSide: H2hSideName | null;
    endedBy: H2hMatchEnd | null;
    sideA: H2hSide;
    sideB: H2hSide;
    score: { a: number; b: number };
    sets: PublicH2hSet[];
}

export interface PublicH2hView {
    roundId: string;
    size: number;
    status: H2hBracketStatus;
    stages: { stage: H2hStage; label: string; setsToWin: number }[];
    entrants: PublicH2hEntrant[];
    matches: PublicH2hMatch[];
}

/** A round's bracket for spectators; a 404 while it has none */
export const publicH2hQuery = queryFamily((roundId) =>
    backendQuery<PublicH2hView>(`h2h/public/${roundId}`, { useAuth: false })
);

export const publicH2hPath = (roundId: string) => `/public/h2h/${roundId}`;

export const publicScoreboardPath = (roundId: string, matchNumber: number) =>
    `/public/h2h/${roundId}/match/${matchNumber}`;

/** A set goes to the first to this many points (I3b) */
export const POINTS_TO_WIN_SET = 3;
/** After this many points with nobody on 3, the set goes to a tie-break */
export const MAX_POINTS_IN_SET = 7;

/** "9.87", "11.87" for a +2, "DNF" */
export const h2hTimeText = (attempt: PublicH2hAttempt) => {
    if (attempt.penalty === DNF_VALUE) return "DNF";
    if (attempt.penalty === DNS_VALUE) return "DNS";
    return resultToString(attempt.value + Math.max(attempt.penalty, 0) * 100);
};

export const sideOf = (match: PublicH2hMatch, side: H2hSideName) =>
    side === "A" ? match.sideA : match.sideB;

export const otherSide = (side: H2hSideName): H2hSideName =>
    side === "A" ? "B" : "A";

export const entrantOf = (
    view: Pick<PublicH2hView, "entrants">,
    side: H2hSide
) => view.entrants.find((entrant) => entrant.id === side.entrantId) ?? null;

/** "Quarterfinal 2" → "QF 2", as empty slots name the match they wait for */
export const shortMatchLabel = (label: string) =>
    label.replace(/^Quarterfinal\b/, "QF").replace(/^Semifinal\b/, "SF");

/**
 * Who plays on this side: the competitor's name, or "Winner of QF 2" while
 * the match that decides it hasn't finished
 */
export const slotText = (
    view: Pick<PublicH2hView, "entrants" | "matches">,
    side: H2hSide
) => {
    const entrant = entrantOf(view, side);
    if (entrant) return entrant.name;
    if (side.source) {
        const from = view.matches.find(
            (m) => m.matchNumber === side.source?.matchNumber
        );
        const outcome = side.source.outcome === "WINNER" ? "Winner" : "Loser";
        return `${outcome} of ${shortMatchLabel(from?.label ?? `match ${side.source.matchNumber}`)}`;
    }
    return "Not seeded yet";
};

/** Points each side won in a set */
export const setPoints = (set: Pick<PublicH2hSet, "points">) => ({
    a: set.points.filter((point) => point.winnerSide === "A").length,
    b: set.points.filter((point) => point.winnerSide === "B").length,
});

/** Each set's points, side A first: "3–1 · 2–3 · 3–0" */
export const setScoresText = (match: Pick<PublicH2hMatch, "sets">) =>
    match.sets
        .map((set) => {
            const { a, b } = setPoints(set);
            return `${a}–${b}`;
        })
        .join(" · ");

/** "First to 2 sets · first to 3 points" */
export const matchFormatText = (setsToWin: number) =>
    `First to ${setsToWin} ${setsToWin === 1 ? "set" : "sets"} · first to ${POINTS_TO_WIN_SET} points`;

/**
 * How a match without a normal ending ended, in plain words; null for one
 * played out or not over
 */
export const matchEndText = (
    view: Pick<PublicH2hView, "entrants">,
    match: PublicH2hMatch
) => {
    if (match.status !== "FINISHED" || !match.winnerSide) return null;
    const loser = entrantOf(view, sideOf(match, otherSide(match.winnerSide)));
    const name = loser?.name ?? "Their opponent";
    if (match.endedBy === "WALKOVER") return `Walkover: ${name} withdrew`;
    if (match.endedBy === "RETIRED") return `${name} retired`;
    return null;
};

// ===== Bracket layout =====

/** A match card's place: its column and the centre of its row, in slots */
export interface PlacedMatch {
    match: PublicH2hMatch;
    column: number;
    y: number;
}

/** A line from a match to the match its winner goes on to */
export interface BracketConnector {
    from: number;
    to: number;
    fromColumn: number;
    fromY: number;
    toY: number;
}

export interface BracketLayout {
    /** Stages left to right; the third-place match sits under the final */
    columns: { stage: H2hStage; label: string }[];
    matches: PlacedMatch[];
    thirdPlace: PlacedMatch | null;
    connectors: BracketConnector[];
    /** Height of the whole bracket, in slots */
    height: number;
}

/** How far under the final the third-place match sits, in slots */
const THIRD_PLACE_GAP = 1.5;

/**
 * Where each match card goes: stages as columns, the first stage's matches
 * one slot apart, and every later match level with the middle of the
 * matches whose winners it takes. With 12 competitors each quarterfinal
 * takes one winner, so it sits level with that match.
 */
export const layoutBracket = (
    view: Pick<PublicH2hView, "stages" | "matches">
): BracketLayout => {
    const columns = view.stages
        .filter((stage) => stage.stage !== "THIRD_PLACE")
        .map(({ stage, label }) => ({ stage, label }));
    const placed = new Map<number, PlacedMatch>();
    const connectors: BracketConnector[] = [];
    columns.forEach(({ stage }, column) => {
        const inStage = view.matches
            .filter((match) => match.stage === stage)
            .sort((x, y) => x.matchNumber - y.matchNumber);
        inStage.forEach((match, index) => {
            const feeders = [match.sideA, match.sideB].flatMap((side) => {
                const from =
                    side.source?.outcome === "WINNER"
                        ? placed.get(side.source.matchNumber)
                        : undefined;
                return from ? [from] : [];
            });
            const y =
                feeders.length > 0
                    ? feeders.reduce((sum, from) => sum + from.y, 0) /
                      feeders.length
                    : index + 0.5;
            placed.set(match.matchNumber, { match, column, y });
            for (const from of feeders) {
                connectors.push({
                    from: from.match.matchNumber,
                    to: match.matchNumber,
                    fromColumn: from.column,
                    fromY: from.y,
                    toY: y,
                });
            }
        });
    });
    const final = [...placed.values()].find((p) => p.match.stage === "FINAL");
    const thirdMatch = view.matches.find((m) => m.stage === "THIRD_PLACE");
    const thirdPlace =
        thirdMatch && final
            ? {
                  match: thirdMatch,
                  column: final.column,
                  y: final.y + THIRD_PLACE_GAP,
              }
            : null;
    const lowest = Math.max(
        0,
        ...[...placed.values(), ...(thirdPlace ? [thirdPlace] : [])].map(
            (p) => p.y + 0.5
        )
    );
    return {
        columns,
        matches: [...placed.values()],
        thirdPlace,
        connectors,
        height: lowest,
    };
};

/** The matches being played, in match order */
export const playingMatches = (view: Pick<PublicH2hView, "matches">) =>
    view.matches.filter((match) => match.status === "IN_PROGRESS");

// ===== Scoreboard =====

export type PointMarker = "won" | "lost" | "none" | "pending";

/**
 * One side's markers for a set: each point it won or lost, one with no
 * winner, and the points still to come as "pending". While the match is
 * being played, a set not yet decided shows as many pending as it could
 * still take if every point had a winner, up to the 7 before the
 * tie-break. Once the match is over (a retirement can end it mid-set),
 * nothing is still to come, and a point left undecided had no winner.
 */
export const pointMarkers = (
    set: Pick<PublicH2hSet, "points" | "winnerSide">,
    side: H2hSideName,
    matchInPlay: boolean
): PointMarker[] => {
    const played = set.points.map((point): PointMarker => {
        if (!point.decided) return matchInPlay ? "pending" : "none";
        if (point.winnerSide === null) return "none";
        return point.winnerSide === side ? "won" : "lost";
    });
    if (set.winnerSide !== null || !matchInPlay) return played;
    const decided = set.points.filter((point) => point.decided).length;
    const { a, b } = setPoints(set);
    const stillPossible = POINTS_TO_WIN_SET - a + (POINTS_TO_WIN_SET - b) - 1;
    const upTo = Math.min(MAX_POINTS_IN_SET, decided + stillPossible);
    return [
        ...played,
        ...Array.from(
            { length: Math.max(0, upTo - played.length) },
            (): PointMarker => "pending"
        ),
    ];
};

/** The last point with a time in it, for the times under each side */
export const latestPoint = (match: Pick<PublicH2hMatch, "sets">) => {
    const withTimes = match.sets
        .flatMap((set) => set.points)
        .filter((point) => point.a !== null || point.b !== null);
    return withTimes[withTimes.length - 1] ?? null;
};

/** Where a point sits in its match, to tell which of two came later */
export interface PointPlace {
    matchNumber: number;
    setNumber: number;
    pointNumber: number;
}

/**
 * Whether the match's last decided point is a new one since `seen`: a
 * later point of the same match. Another match, or a point going back to
 * undecided (an extra granted, a reopened match), is not.
 */
export const isLaterPoint = (place: PointPlace, seen: PointPlace) =>
    place.matchNumber === seen.matchNumber &&
    (place.setNumber > seen.setNumber ||
        (place.setNumber === seen.setNumber &&
            place.pointNumber > seen.pointNumber));

/** The last decided point, whose winner lights up for a moment */
export const lastDecidedPoint = (match: Pick<PublicH2hMatch, "sets">) => {
    for (const set of [...match.sets].reverse()) {
        const point = [...set.points].reverse().find((p) => p.decided);
        if (point) return { setNumber: set.setNumber, point };
    }
    return null;
};

/**
 * The winner of a finished match and who they play next, read from the
 * bracket: "Wins by walkover", "Next: Final against Winner of SF 2"
 */
export const matchOutcome = (view: PublicH2hView, match: PublicH2hMatch) => {
    if (match.status !== "FINISHED" || !match.winnerSide) return null;
    const winner = entrantOf(view, sideOf(match, match.winnerSide));
    const how =
        match.endedBy === "WALKOVER"
            ? "wins by walkover"
            : match.endedBy === "RETIRED"
              ? "wins: their opponent retired"
              : match.stage === "FINAL"
                ? "wins the final"
                : match.stage === "THIRD_PLACE"
                  ? "takes third place"
                  : `wins ${match.label}`;
    const next = view.matches.find((m) =>
        [m.sideA, m.sideB].some(
            (side) =>
                side.source?.matchNumber === match.matchNumber &&
                side.source.outcome === "WINNER"
        )
    );
    let nextText: string | null = null;
    if (next) {
        const opponent =
            next.sideA.source?.matchNumber === match.matchNumber &&
            next.sideA.source.outcome === "WINNER"
                ? next.sideB
                : next.sideA;
        nextText = `Next: ${next.label} against ${slotText(view, opponent)}`;
    }
    return {
        winnerName: winner?.name ?? "The winner",
        how,
        next: nextText,
    };
};

/**
 * The station a competitor is at, by the registrant id it reports; the one
 * heard from last when two report the same person
 */
export const stationOf = (
    stations: Iterable<StationInfo>,
    registrantId: number | null
) => {
    if (registrantId === null) return null;
    let found: StationInfo | null = null;
    for (const station of stations) {
        if (station.registrantId !== registrantId) continue;
        if (!found || station.serverReceivedAt > found.serverReceivedAt) {
            found = station;
        }
    }
    return found;
};

// ===== Results =====

/** Faster first, then DNF or DNS, then no attempt at all */
const singleRank = (single: number | null) =>
    single === null
        ? Number.MAX_SAFE_INTEGER
        : single > 0
          ? single
          : Number.MAX_SAFE_INTEGER - 1;

/**
 * The entrants in the order of the round's final ranking (9f16b), as the
 * backend works it out: positions first, then everyone still in play or
 * without an attempt, by best single, then by seed
 */
export const rankedEntrants = (entrants: PublicH2hEntrant[]) =>
    [...entrants].sort(
        (x, y) =>
            (x.position ?? Infinity) - (y.position ?? Infinity) ||
            singleRank(x.bestSingle) - singleRank(y.bestSingle) ||
            x.seed - y.seed
    );
