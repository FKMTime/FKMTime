import { Cutoff, TimeLimit } from "@wca/helpers";

import { resultToString } from "@/lib/resultFormatters";
import { cumulativeRoundsToString } from "@/lib/utils";

interface RoundLimitsProps {
    cutoff: Cutoff | null;
    limit: TimeLimit | null;
    maxAttempts: number;
    size: string;
}

const RoundLimits = ({
    cutoff,
    limit,
    maxAttempts,
    size,
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
                    ? `${resultToString(limit.centiseconds)} ${limit.cumulativeRoundIds.length > 0 ? "(cumulative)" : ""}`
                    : "None"}
            </p>
            <p className={`text-${size}`}>Attempts: {maxAttempts}</p>
        </>
    );
};

export default RoundLimits;
