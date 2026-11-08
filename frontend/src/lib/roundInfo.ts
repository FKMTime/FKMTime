import { Competition as WCIF, getRoundInfoFromWcif } from "wcif-helpers";

import { resultToString } from "./resultFormatters";
import { cumulativeRoundsToString, prettyRoundFormat } from "./utils";

export interface RoundMeta {
    format: string;
    timeLimit?: string;
    cutoff?: string;
}

/** "Average of 5", "Time limit 10:00.00 (cumulative for …)", "Cutoff 1:00.00 (2 attempts)" */
export const getRoundMeta = (roundId: string, wcif: WCIF): RoundMeta | null => {
    const round = getRoundInfoFromWcif(roundId, wcif);
    if (!round) return null;
    const limit = round.timeLimit;
    const cumulative = limit?.cumulativeRoundIds ?? [];
    const cutoff = round.cutoff;
    return {
        format: prettyRoundFormat(round.format),
        timeLimit: limit
            ? `${resultToString(limit.centiseconds)}${cumulative.length ? ` (cumulative for ${cumulativeRoundsToString(cumulative)})` : ""}`
            : undefined,
        cutoff: cutoff
            ? `${resultToString(cutoff.resultValue)} (${cutoff.numberOfAttempts} ${cutoff.numberOfAttempts === 1 ? "attempt" : "attempts"})`
            : undefined,
    };
};
