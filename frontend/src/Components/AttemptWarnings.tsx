import { Badge } from "@chakra-ui/react";

import { Attempt } from "@/lib/interfaces";
import { milisecondsToClockFormat } from "@/lib/resultFormatters";

interface AttemptsWarningProps {
    attempt: Attempt;
}

const AttemptWarnings = ({ attempt }: AttemptsWarningProps) => {
    const inspectionExceeded =
        attempt.inspectionTime && attempt.inspectionTime > 15000;

    return (
        <>
            {inspectionExceeded ? (
                <Badge colorScheme="red" borderRadius="md" p="1">
                    Inspection:{" "}
                    {milisecondsToClockFormat(attempt.inspectionTime || 0)}
                </Badge>
            ) : null}
            {attempt.penalty > 2 && (
                <Badge colorScheme="red" borderRadius="md" p="1">
                    +{attempt.penalty}
                </Badge>
            )}
            {attempt.penalty === -2 && (
                <Badge colorScheme="yellow" borderRadius="md" p="1">
                    DNS
                </Badge>
            )}
        </>
    );
};

export default AttemptWarnings;
