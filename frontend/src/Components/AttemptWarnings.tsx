import { Link } from "react-router-dom";

import { activityCodeToName } from "@/lib/activities";
import { DNS_VALUE } from "@/lib/constants";
import { Attempt, AttemptType } from "@/lib/interfaces";
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
            {attempt.penalty === DNS_VALUE && <Badge>DNS</Badge>}
            {attempt.fastAttemptRatio !== undefined && (
                <Badge className="border-transparent bg-amber-500 text-white shadow">
                    Fast ({Math.round(attempt.fastAttemptRatio * 100)}%)
                </Badge>
            )}
            {attempt.staffingWarnings?.map((warning) => (
                <Link
                    key={`${warning.role}-${warning.staffedAttemptId}`}
                    to={`/results/${warning.staffedResultId}`}
                    title={`Recorded before this solve in ${activityCodeToName(warning.groupId)}. Group inferred from competitor attendance; review manually.`}
                >
                    <Badge className="border-transparent bg-amber-500 text-white shadow">
                        {warning.role === "JUDGE" ? "Judged" : "Scrambled"}{" "}
                        {warning.staffedPersonName}&apos;s attempt{" "}
                        {warning.staffedAttemptType ===
                        AttemptType.EXTRA_ATTEMPT
                            ? "E"
                            : ""}
                        {warning.staffedAttemptNumber} before competing in group{" "}
                        {warning.groupId.split("-g")[1]}
                    </Badge>
                </Link>
            ))}
        </>
    );
};

export default AttemptWarnings;
