import { ArrowRight } from "lucide-react";

import AttemptResultInput from "@/Components/AttemptResultInput";
import AttemptWarnings from "@/Components/AttemptWarnings";
import PenaltySelect from "@/Components/PenaltySelect";
import { useToast } from "@/hooks/useToast";
import { DNF_VALUE, DNS_VALUE } from "@/lib/constants";
import {
    Attempt,
    AttemptType,
    Competition,
    ResultToDoubleCheck,
} from "@/lib/interfaces";
import { attemptWithPenaltyToString } from "@/lib/resultFormatters";
import { checkTimeLimit } from "@/lib/results";
import { cn, getSubmittedAttempts } from "@/lib/utils";

interface AttemptsListProps {
    result: ResultToDoubleCheck;
    updateAttempt: (attempt: Attempt) => void;
    competition: Competition;
}

const GRID =
    "grid grid-cols-[22px_minmax(80px,120px)_72px_16px_minmax(72px,96px)] items-center gap-2 sm:gap-3";

/** Editable attempts of the result being checked: time, penalty → final */
const AttemptsList = ({
    result,
    competition,
    updateAttempt,
}: AttemptsListProps) => {
    const { toast } = useToast();
    const submittedAttempts = getSubmittedAttempts(result.attempts);

    const updateTime = (attempt: Attempt, value: number) => {
        if (!checkTimeLimit(value, competition.wcif, result.roundId)) {
            toast({
                title: "This attempt is over the time limit.",
                description: "This time is DNF.",
                variant: "destructive",
            });
            updateAttempt({ ...attempt, value, penalty: DNF_VALUE });
            return;
        }
        updateAttempt({ ...attempt, value });
    };

    return (
        <div className="flex flex-col">
            <div
                className={cn(
                    GRID,
                    "pb-2 text-xs font-semibold text-faint [&>span:nth-child(5)]:text-right"
                )}
            >
                <span>#</span>
                <span className="text-right">Time</span>
                <span>Penalty</span>
                <span />
                <span className="text-foreground">Final</span>
            </div>
            {submittedAttempts.map((attempt) => {
                const isExtra = attempt.type === AttemptType.EXTRA_ATTEMPT;
                const number = `${isExtra ? "E" : ""}${attempt.attemptNumber}`;
                const isDnf =
                    attempt.penalty === DNF_VALUE ||
                    attempt.penalty === DNS_VALUE;
                return (
                    <div key={attempt.id} className="border-t py-2">
                        <div className={GRID}>
                            <span className="text-sm font-bold text-faint">
                                {number}
                            </span>
                            <AttemptResultInput
                                value={attempt.value}
                                onChange={(value) => updateTime(attempt, value)}
                                className="text-right font-medium md:text-[15px]"
                            />
                            <PenaltySelect
                                value={attempt.penalty}
                                onChange={(penalty) =>
                                    updateAttempt({ ...attempt, penalty })
                                }
                                shortVersion
                                className="px-2"
                                aria-label={`Penalty for attempt ${number}`}
                            />
                            <ArrowRight
                                aria-hidden
                                className="size-4 text-faint"
                            />
                            <span
                                className={cn(
                                    "whitespace-nowrap rounded-lg bg-secondary px-2.5 py-2 text-right text-base font-bold",
                                    isDnf && "text-destructive"
                                )}
                            >
                                {attemptWithPenaltyToString(attempt)}
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-1 pl-[30px] empty:hidden sm:pl-[34px] [&:not(:empty)]:pt-1.5">
                            <AttemptWarnings attempt={attempt} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default AttemptsList;
