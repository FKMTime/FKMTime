import { Cutoff, TimeLimit } from "@wca/helpers";

import { RemainingAndUsedCumulativeLimit } from "@/lib/interfaces";
import {
    centisecondsToClockFormat,
    resultToString,
} from "@/lib/resultFormatters";
import { cumulativeRoundsToString } from "@/lib/utils";

interface RoundLimitsProps {
    cutoff: Cutoff | null;
    limit: TimeLimit | null;
    maxAttempts: number;
    size: string;
    showRemainingAndUsedCumulativeLimit?: boolean;
    remainingAndUsedCumulativeLimit?: RemainingAndUsedCumulativeLimit;
}

const RoundLimits = ({
    cutoff,
    limit,
    maxAttempts,
    size,
    showRemainingAndUsedCumulativeLimit,
    remainingAndUsedCumulativeLimit,
}: RoundLimitsProps) => {
    return (
        <>
            <p className={`text-${size}`}>
                Cutoff:{" "}
                {cutoff
                    ? `${resultToString(cutoff.attemptResult)} (${cutoff.numberOfAttempts} attempts)`
                    : "None"}
            </p>
            <p
                className={`text-${size}`}
                title={`For ${cumulativeRoundsToString(limit?.cumulativeRoundIds || [])}`}
            >
                Limit:{" "}
                {limit
                    ? `${resultToString(limit.centiseconds)} ${limit.cumulativeRoundIds.length > 0 ? `(cumulative for ${cumulativeRoundsToString(limit?.cumulativeRoundIds || [])})` : ""}`
                    : "None"}
            </p>
            {showRemainingAndUsedCumulativeLimit &&
                limit &&
                limit.cumulativeRoundIds.length > 0 && (
                    <p className={`text-${size}`}>
                        Used (remaining) cumulative limit:{" "}
                        {centisecondsToClockFormat(
                            remainingAndUsedCumulativeLimit?.used ?? 0
                        )}
                        {" ("}
                        {centisecondsToClockFormat(
                            remainingAndUsedCumulativeLimit?.remaining ?? 0
                        )}
                        {")"}
                    </p>
                )}
            <p className={`text-${size}`}>Attempts: {maxAttempts}</p>
        </>
    );
};

export default RoundLimits;
