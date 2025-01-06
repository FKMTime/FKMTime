import { Text } from "@chakra-ui/react";
import { Cutoff, TimeLimit } from "@wca/helpers";

import { resultToString } from "@/lib/resultFormatters";
import { cumulativeRoundsToString } from "@/logic/utils";

interface RoundLimitsProps {
    cutoff: Cutoff | null;
    limit: TimeLimit | null;
    maxAttempts: number;
    fontSize?: string;
}

const RoundLimits = ({
    cutoff,
    limit,
    maxAttempts,
    fontSize,
}: RoundLimitsProps) => {
    return (
        <>
            <Text fontSize={fontSize}>
                Cutoff:{" "}
                {cutoff
                    ? `${resultToString(cutoff.attemptResult)} (${cutoff.numberOfAttempts} attempts)`
                    : "None"}
            </Text>
            <Text
                fontSize={fontSize}
                title={`For ${cumulativeRoundsToString(limit?.cumulativeRoundIds || [])}`}
            >
                Limit:{" "}
                {limit
                    ? `${resultToString(limit.centiseconds)} ${limit.cumulativeRoundIds.length > 0 ? "(cumulative)" : ""}`
                    : "None"}
            </Text>
            <Text fontSize={fontSize}>Attempts: {maxAttempts}</Text>
        </>
    );
};

export default RoundLimits;
