import { average } from "./average";
import { DNF_VALUE, DNS_VALUE } from "./constants";
import { Attempt, Result } from "./interfaces";
import { getSubmittedAttempts } from "./utils";

const DNF_AVERAGE = 1e12;
const INCOMPLETE = 2e12;

/** Centiseconds including +2, or Infinity for DNF/DNS */
export const attemptValue = (attempt: Attempt) =>
    attempt.penalty === DNF_VALUE || attempt.penalty === DNS_VALUE
        ? Infinity
        : attempt.value + Math.max(attempt.penalty, 0) * 100;

export interface RankedResult {
    result: Result;
    /** Shared by ties; null for a result with no counting attempts yet */
    position: number | null;
    submitted: Attempt[];
    /** Centiseconds, DNF_VALUE, or null while attempts are missing */
    average: number | null;
}

const BEST_OF_FORMATS = ["1", "2", "3", "5"];

/**
 * Orders results as on WCA Live: by average then best for average and mean
 * formats, by best for best-of formats. Incomplete averages go after
 * complete ones, results without attempts last.
 */
export const rankResults = (
    results: Result[],
    maxAttempts: number,
    format: string
): RankedResult[] => {
    const rows = results.map((result) => {
        const submitted = getSubmittedAttempts(result.attempts);
        const isComplete = submitted.length === maxAttempts;
        const resultAverage = isComplete ? average(submitted) ?? null : null;
        const bestKey = Math.min(Infinity, ...submitted.map(attemptValue));
        let averageKey = INCOMPLETE;
        if (resultAverage !== null)
            averageKey = resultAverage > 0 ? resultAverage : DNF_AVERAGE;
        const keys = BEST_OF_FORMATS.includes(format)
            ? [bestKey]
            : [averageKey, bestKey];
        return {
            result,
            submitted,
            average: resultAverage,
            keys,
            hasAttempts: submitted.length > 0,
        };
    });

    const compare = (a: number[], b: number[]) => {
        for (let i = 0; i < a.length; i++)
            if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
        return 0;
    };
    rows.sort(
        (a, b) =>
            Number(b.hasAttempts) - Number(a.hasAttempts) ||
            compare(a.keys, b.keys) ||
            a.result.person.name.localeCompare(b.result.person.name)
    );

    let position = 0;
    return rows.map((row, index) => {
        const isTie =
            index > 0 && compare(rows[index - 1].keys, row.keys) === 0;
        if (!isTie) position = index + 1;
        return {
            result: row.result,
            position: row.hasAttempts ? position : null,
            submitted: row.submitted,
            average: row.average,
        };
    });
};
