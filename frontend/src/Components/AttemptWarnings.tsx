import { Badge } from "@chakra-ui/react";

import { Attempt } from "@/logic/interfaces";
import { milisecondsToClockFormat } from "@/logic/resultFormatters";

interface AttemptsWarningProps {
    attempt: Attempt;
}

const AttemptWarnings = ({ attempt }: AttemptsWarningProps) => {
    const inspectionExceeded =
        attempt.inspectionTime && attempt.inspectionTime > 15000;

    return (
        <>
            {inspectionExceeded ? (
                <Badge colorPalette="red" borderRadius="md" p="1">
                    Inspection:{" "}
                    {milisecondsToClockFormat(attempt.inspectionTime || 0)}
                </Badge>
            ) : null}
            {attempt.penalty > 2 && (
                <Badge colorPalette="red" borderRadius="md" p="1">
                    +{attempt.penalty}
                </Badge>
            )}
            {attempt.penalty === -2 && (
                <Badge colorPalette="yellow" borderRadius="md" p="1">
                    DNS
                </Badge>
            )}
        </>
    );
};

export default AttemptWarnings;
