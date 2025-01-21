import { Attempt } from "@/lib/interfaces";
import { milisecondsToClockFormat } from "@/lib/resultFormatters";

import { Badge } from "./ui/badge";

interface AttemptsWarningProps {
    attempt: Attempt;
}

const AttemptWarnings = ({ attempt }: AttemptsWarningProps) => {
    const inspectionExceeded =
        attempt.inspectionTime && attempt.inspectionTime > 15000;

    return (
        <>
            {inspectionExceeded ? (
                <Badge variant="destructive">
                    Inspection:{" "}
                    {milisecondsToClockFormat(attempt.inspectionTime || 0)}
                </Badge>
            ) : null}
            {attempt.penalty > 2 && (
                <Badge variant="destructive">+{attempt.penalty}</Badge>
            )}
            {attempt.penalty === -2 && <Badge>DNS</Badge>}
        </>
    );
};

export default AttemptWarnings;
