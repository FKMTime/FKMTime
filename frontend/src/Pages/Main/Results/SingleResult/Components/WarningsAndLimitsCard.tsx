import { useMemo } from "react";
import { getCutoffByRoundId, TimeLimit } from "wcif-helpers";

import { StatusBadge } from "@/Components/shared/StatusBadge";
import { isUnofficialEvent } from "@/lib/events";
import {
    Attempt,
    Competition,
    RemainingAndUsedCumulativeLimit,
    Result,
} from "@/lib/interfaces";
import {
    centisecondsToClockFormat,
    resultToString,
} from "@/lib/resultFormatters";
import {
    cumulativeRoundsToString,
    isThereADifferenceBetweenResults,
} from "@/lib/utils";

interface WarningsAndLimitsCardProps {
    competition: Competition;
    result: Result;
    submittedAttempts: Attempt[];
    limit: TimeLimit | null;
    maxAttempts: number;
    remainingAndUsedCumulativeLimit?: RemainingAndUsedCumulativeLimit;
}

const Fact = ({ label, value }: { label: string; value: string }) => (
    <span>
        {label} <b className="font-semibold text-foreground">{value}</b>
    </span>
);

/** Round limits plus anything about this result that needs a second look */
const WarningsAndLimitsCard = ({
    competition,
    result,
    submittedAttempts,
    limit,
    maxAttempts,
    remainingAndUsedCumulativeLimit,
}: WarningsAndLimitsCardProps) => {
    const isDifferenceBetweenResults = useMemo(
        () =>
            !isUnofficialEvent(result.eventId) &&
            isThereADifferenceBetweenResults(
                result,
                submittedAttempts,
                competition.wcif
            ),
        [competition, result, submittedAttempts]
    );
    const cutoff = getCutoffByRoundId(result.roundId, competition.wcif);
    const isCumulative = !!limit && limit.cumulativeRoundIds.length > 0;
    const hasStaffingWarnings = result.attempts.some(
        (attempt) => attempt.staffingWarnings?.length
    );

    return (
        <section className="flex flex-col gap-2.5 rounded-mobile-card border bg-card px-5 py-[18px] md:rounded-2xl">
            <h3 className="text-xs font-semibold text-faint">
                Limits &amp; warnings
            </h3>
            <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[13px] text-muted-foreground">
                <span
                    title={
                        isCumulative
                            ? `Cumulative for ${cumulativeRoundsToString(limit.cumulativeRoundIds)}`
                            : undefined
                    }
                >
                    <Fact
                        label="Time limit"
                        value={
                            limit
                                ? `${resultToString(limit.centiseconds)}${isCumulative ? " cumulative" : ""}`
                                : "None"
                        }
                    />
                </span>
                {cutoff && (
                    <Fact
                        label="Cutoff"
                        value={`${resultToString(cutoff.resultValue)} (${cutoff.numberOfAttempts} att.)`}
                    />
                )}
                <Fact label="Attempts" value={`${maxAttempts}`} />
                {isCumulative && remainingAndUsedCumulativeLimit && (
                    <>
                        <Fact
                            label="Used"
                            value={centisecondsToClockFormat(
                                remainingAndUsedCumulativeLimit.used
                            )}
                        />
                        <Fact
                            label="Remaining"
                            value={centisecondsToClockFormat(
                                remainingAndUsedCumulativeLimit.remaining
                            )}
                        />
                    </>
                )}
            </div>
            {isDifferenceBetweenResults || hasStaffingWarnings ? (
                <div className="flex flex-wrap gap-1.5">
                    {isDifferenceBetweenResults && (
                        <span title="Check it manually, fix it in FKMTime and resubmit the scorecard to WCA Live.">
                            <StatusBadge tone="destructive">
                                Differs from WCA Live
                            </StatusBadge>
                        </span>
                    )}
                    {hasStaffingWarnings && (
                        <span title="Recorded as judging or scrambling before a later solve in the same group. Groups are inferred from competitor attendance; review the attempt warnings.">
                            <StatusBadge tone="warning">
                                Staffed before competing
                            </StatusBadge>
                        </span>
                    )}
                </div>
            ) : (
                <span className="text-[13px] text-success">No warnings</span>
            )}
        </section>
    );
};

export default WarningsAndLimitsCard;
