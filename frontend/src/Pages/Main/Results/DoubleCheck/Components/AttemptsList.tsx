import { useMemo } from "react";
import {
    getCutoffByRoundId,
    getLimitByRoundId,
    getRoundInfoFromWcif,
} from "wcif-helpers";

import AttemptResultInput from "@/Components/AttemptResultInput";
import AttemptWarnings from "@/Components/AttemptWarnings";
import PenaltySelect from "@/Components/PenaltySelect";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { useToast } from "@/hooks/useToast";
import { DNF_VALUE, DNS_VALUE } from "@/lib/constants";
import {
    Attempt,
    AttemptType,
    Competition,
    RemainingAndUsedCumulativeLimit,
    ResultToDoubleCheck,
} from "@/lib/interfaces";
import {
    attemptWithPenaltyToString,
    centisecondsToClockFormat,
    resultToString,
} from "@/lib/resultFormatters";
import { checkTimeLimit } from "@/lib/results";
import { getSubmittedAttempts } from "@/lib/utils";

interface AttemptsListProps {
    result: ResultToDoubleCheck;
    updateAttempt: (attempt: Attempt) => void;
    competition: Competition;
    cumulativeLimit?: RemainingAndUsedCumulativeLimit | null;
}

const getEffectiveTime = (attempt: Attempt): number | null => {
    if (attempt.penalty === DNF_VALUE || attempt.penalty === DNS_VALUE)
        return null;
    return attempt.value + (attempt.penalty > 0 ? attempt.penalty * 100 : 0);
};

const computeBestAndAverage = (
    submitted: Attempt[],
    format: string
): { best: number | null; average: number | null } => {
    const times = submitted
        .map(getEffectiveTime)
        .filter((t): t is number => t !== null && t > 0);

    const best = times.length > 0 ? Math.min(...times) : null;

    const allTimes = submitted.map((a) =>
        a.penalty === DNF_VALUE || a.penalty === DNS_VALUE
            ? DNF_VALUE
            : a.value + (a.penalty > 0 ? a.penalty * 100 : 0)
    );

    let average: number | null = null;
    const dnfCount = allTimes.filter((t) => t === DNF_VALUE).length;

    if (format === "a" && allTimes.length === 5) {
        if (dnfCount >= 2) {
            average = DNF_VALUE;
        } else {
            const sorted = [...allTimes].sort((a, b) => {
                if (a === DNF_VALUE) return 1;
                if (b === DNF_VALUE) return -1;
                return a - b;
            });
            average = Math.round(
                sorted.slice(1, 4).reduce((s, t) => s + t, 0) / 3
            );
        }
    } else if (format === "m" && allTimes.length === 3) {
        average =
            dnfCount > 0
                ? DNF_VALUE
                : Math.round(allTimes.reduce((s, t) => s + t, 0) / 3);
    }

    return { best, average };
};

const AttemptsList: React.FC<AttemptsListProps> = ({
    result,
    competition,
    updateAttempt,
    cumulativeLimit,
}) => {
    const { toast } = useToast();
    const submittedAttempts = getSubmittedAttempts(result.attempts);

    const roundInfo = useMemo(
        () => getRoundInfoFromWcif(result.roundId, competition.wcif),
        [result.roundId, competition.wcif]
    );

    const cutoff = useMemo(
        () => getCutoffByRoundId(result.roundId, competition.wcif),
        [result.roundId, competition.wcif]
    );

    const limit = useMemo(
        () => getLimitByRoundId(result.roundId, competition.wcif),
        [result.roundId, competition.wcif]
    );

    const { best, average } = useMemo(
        () => computeBestAndAverage(submittedAttempts, roundInfo?.format ?? ""),
        [submittedAttempts, roundInfo?.format]
    );

    const isAvgFormat = roundInfo?.format === "a" || roundInfo?.format === "m";

    return (
        <div className="flex flex-col gap-4">
            {/* Best / Average summary */}
            <div className="flex gap-6">
                {best !== null && (
                    <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">
                            Best
                        </span>
                        <span className="text-2xl font-bold">
                            {resultToString(best)}
                        </span>
                    </div>
                )}
                {isAvgFormat && average !== null && (
                    <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">
                            {roundInfo?.format === "m" ? "Mean" : "Average"}
                        </span>
                        <span className="text-2xl font-bold">
                            {resultToString(average)}
                        </span>
                    </div>
                )}
            </div>

            {/* Limit / Cutoff */}
            {(limit || cutoff) && (
                <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                    {cutoff && (
                        <span>
                            Cutoff:{" "}
                            <span className="font-medium text-foreground">
                                {resultToString(cutoff.resultValue)} (
                                {cutoff.numberOfAttempts} att.)
                            </span>
                        </span>
                    )}
                    {limit && (
                        <span>
                            Limit:{" "}
                            <span className="font-medium text-foreground">
                                {resultToString(limit.centiseconds)}
                                {limit.cumulativeRoundIds.length > 0
                                    ? " (cumulative)"
                                    : ""}
                            </span>
                        </span>
                    )}
                    {limit &&
                        limit.cumulativeRoundIds.length > 0 &&
                        cumulativeLimit && (
                            <>
                                <span>
                                    Used:{" "}
                                    <span className="font-medium text-foreground">
                                        {centisecondsToClockFormat(
                                            cumulativeLimit.used
                                        )}
                                    </span>
                                </span>
                                <span>
                                    Remaining:{" "}
                                    <span className="font-medium text-foreground">
                                        {centisecondsToClockFormat(
                                            cumulativeLimit.remaining
                                        )}
                                    </span>
                                </span>
                            </>
                        )}
                </div>
            )}

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead color="white">Attempt</TableHead>
                        <TableHead
                            color="white"
                            className="hidden md:table-cell"
                        >
                            Time
                        </TableHead>
                        <TableHead
                            color="white"
                            className="hidden md:table-cell"
                        >
                            Penalty
                        </TableHead>
                        <TableHead color="white" className="font-bold">
                            Result
                        </TableHead>
                        <TableHead
                            className="hidden md:table-cell"
                            color="white"
                        >
                            Warnings
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {submittedAttempts.map((attempt) => (
                        <TableRow key={attempt.id}>
                            <TableCell>
                                {attempt.type === AttemptType.EXTRA_ATTEMPT
                                    ? `E${attempt.attemptNumber}`
                                    : attempt.attemptNumber}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                                <AttemptResultInput
                                    value={attempt.value}
                                    disabled={false}
                                    onChange={(newValue) => {
                                        if (!competition) {
                                            updateAttempt({
                                                ...attempt,
                                                value: newValue,
                                            });
                                            return;
                                        }
                                        const isLimitPassed = checkTimeLimit(
                                            newValue,
                                            competition?.wcif,
                                            result.roundId
                                        );
                                        if (!isLimitPassed) {
                                            toast({
                                                title: "This attempt is over the time limit.",
                                                description:
                                                    "This time is DNF.",
                                                variant: "destructive",
                                            });
                                            updateAttempt({
                                                ...attempt,
                                                value: newValue,
                                                penalty: DNF_VALUE,
                                            });
                                            return;
                                        }
                                        updateAttempt({
                                            ...attempt,
                                            value: newValue,
                                        });
                                    }}
                                />
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                                <PenaltySelect
                                    value={attempt.penalty}
                                    onChange={(value) =>
                                        updateAttempt({
                                            ...attempt,
                                            penalty: value,
                                        })
                                    }
                                    shortVersion
                                    disabled={false}
                                />
                            </TableCell>
                            <TableCell className="font-bold text-lg">
                                {attemptWithPenaltyToString(attempt)}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                                <div className="flex gap-1">
                                    <AttemptWarnings attempt={attempt} />
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};

export default AttemptsList;
