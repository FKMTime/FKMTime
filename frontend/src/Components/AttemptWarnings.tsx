import { Badge } from "@chakra-ui/react";

import { Attempt } from "@/logic/interfaces";
import { milisecondsToClockFormat } from "@/logic/resultFormatters";

interface AttemptsWarningProps {
    attempt: Attempt;
}

const AttemptWarnings = ({ attempt }: AttemptsWarningProps) => {
    return (
        <>
            {attempt.inspectionTime && attempt.inspectionTime > 15000 && (
                <Badge colorScheme="red" borderRadius="md" p="1">
                    Inspection:{" "}
                    {milisecondsToClockFormat(attempt.inspectionTime)}
                </Badge>
            )}
            {attempt.penalty > 2 && (
                <Badge colorScheme="red" borderRadius="md" p="1">
                    +{attempt.penalty}
                </Badge>
            )}
        </>
    );
};

export default AttemptWarnings;
