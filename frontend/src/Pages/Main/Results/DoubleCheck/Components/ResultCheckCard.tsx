import { Check, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import {
    getCutoffByRoundId,
    getLimitByRoundId,
    getNumberOfAttemptsForRound,
    getRoundInfoFromWcif,
} from "wcif-helpers";

import { Button } from "@/Components/ui/button";
import { average, formattedBest } from "@/lib/average";
import {
    Attempt,
    Competition,
    RemainingAndUsedCumulativeLimit,
    ResultToDoubleCheck,
} from "@/lib/interfaces";
import {
    centisecondsToClockFormat,
    resultToString,
} from "@/lib/resultFormatters";
import { getSubmittedAttempts } from "@/lib/utils";

import AttemptsList from "./AttemptsList";

interface ResultCheckCardProps {
    result: ResultToDoubleCheck;
    competition: Competition;
    cumulativeLimit: RemainingAndUsedCumulativeLimit | null;
    isSubmitting: boolean;
    updateAttempt: (attempt: Attempt) => void;
    onConfirm: () => void;
    onSkip: () => void;
}

/** The scorecard being checked: summary, editable attempts, Confirm / Skip */
const ResultCheckCard = ({
    result,
    competition,
    cumulativeLimit,
    isSubmitting,
    updateAttempt,
    onConfirm,
    onSkip,
}: ResultCheckCardProps) => {
    const { wcif } = competition;
    const submitted = getSubmittedAttempts(result.attempts);
    const format = getRoundInfoFromWcif(result.roundId, wcif)?.format;
    const maxAttempts = getNumberOfAttemptsForRound(result.roundId, wcif);
    const cutoff = getCutoffByRoundId(result.roundId, wcif);
    const limit = getLimitByRoundId(result.roundId, wcif);
    const isCumulative = !!limit && limit.cumulativeRoundIds.length > 0;

    const averageValue =
        (format === "a" || format === "m") && submitted.length === maxAttempts
            ? average(submitted)
            : undefined;
    const summary = [
        averageValue !== undefined &&
            `${format === "m" ? "Mean" : "Average"} ${resultToString(averageValue)}`,
        `Best ${formattedBest(submitted) || "—"}`,
    ]
        .filter(Boolean)
        .join(" · ");
    const limits = [
        cutoff &&
            `Cutoff ${resultToString(cutoff.resultValue)} (${cutoff.numberOfAttempts} att.)`,
        limit &&
            `Limit ${resultToString(limit.centiseconds)}${isCumulative ? " cumulative" : ""}`,
        isCumulative &&
            cumulativeLimit &&
            `Used ${centisecondsToClockFormat(cumulativeLimit.used)} · Remaining ${centisecondsToClockFormat(cumulativeLimit.remaining)}`,
    ]
        .filter(Boolean)
        .join(" · ");

    return (
        <section className="flex flex-col gap-4 rounded-mobile-card border bg-card p-4 md:rounded-2xl md:p-[22px]">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-lg font-bold">
                        {result.person.name}{" "}
                        <span className="font-medium text-faint">
                            ({result.person.registrantId})
                        </span>
                    </h3>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                        {summary}
                    </p>
                    {limits && (
                        <p className="mt-0.5 text-xs text-faint">{limits}</p>
                    )}
                </div>
                <Button
                    variant="link"
                    size="sm"
                    className="shrink-0 px-2.5 hover:no-underline"
                    asChild
                >
                    <Link to={`/results/${result.id}`}>Details</Link>
                </Button>
            </div>
            <AttemptsList
                result={result}
                competition={competition}
                updateAttempt={updateAttempt}
            />
            <div className="flex gap-2">
                <Button
                    variant="success"
                    className="h-11 flex-1 rounded-[10px] text-[15px] md:h-11 [&_svg]:size-5"
                    onClick={onConfirm}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <Loader2 className="animate-spin" />
                    ) : (
                        <Check />
                    )}
                    Confirm
                </Button>
                <Button
                    variant="ghost"
                    className="h-11 rounded-[10px] md:h-11"
                    onClick={onSkip}
                >
                    Skip
                </Button>
            </div>
        </section>
    );
};

export default ResultCheckCard;
