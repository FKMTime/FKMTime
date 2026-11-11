import { Undo2 } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/Components/ui/button";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import { DnfRuling, restoreDnfAttempts } from "@/lib/attempt";
import { Attempt, AttemptType } from "@/lib/interfaces";
import { attemptWithPenaltyToString } from "@/lib/resultFormatters";
import { shortRoundName } from "@/lib/utils";

const attemptLabel = (attempt: Attempt) =>
    attempt.type === AttemptType.EXTRA_ATTEMPT
        ? `Extra ${attempt.attemptNumber}`
        : `Attempt ${attempt.attemptNumber}`;

interface DnfRulingCardProps {
    resultId: string;
    attempts: Attempt[];
    /** Attempts a delegate ruled DNF, and later-round results it removed */
    ruling: DnfRuling;
    onRestored: () => void;
}

/** Attempts ruled DNF next to their own time, with a way back */
const DnfRulingCard = ({
    resultId,
    attempts,
    ruling,
    onRestored,
}: DnfRulingCardProps) => {
    const confirm = useConfirm();
    const { toast } = useToast();

    const handleRestore = () =>
        confirm({
            title: "Restore the original attempts?",
            description:
                ruling.removedResults.length > 0
                    ? "Each attempt gets back its own time and penalty, remaining attempts can be done again, the removed results in later rounds count again, and the scorecards are sent again."
                    : "Each attempt gets back its own time and penalty, remaining attempts can be done again, and the scorecard is sent again.",
            confirmLabel: "Restore",
            onConfirm: async () => {
                const { status, message } = await restoreDnfAttempts(resultId);
                if (status === 200) {
                    toast({
                        title: "Original attempts restored",
                        variant: "success",
                    });
                    onRestored();
                } else {
                    toast({
                        title: "Error",
                        description: message ?? "Something went wrong",
                        variant: "destructive",
                    });
                }
            },
        }).catch(() => undefined);

    const byId = new Map(
        ruling.attempts.map((attempt) => [attempt.id, attempt])
    );
    const sorted = attempts
        .filter((attempt) => byId.has(attempt.id))
        .sort(
            (a, b) =>
                a.type.localeCompare(b.type) * -1 ||
                a.attemptNumber - b.attemptNumber
        );

    return (
        <section
            aria-label="Attempts ruled DNF"
            className="flex flex-col gap-3 rounded-mobile-card border bg-card px-5 py-[18px] md:rounded-2xl"
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">Ruled DNF</h3>
                <Button variant="outline" size="sm" onClick={handleRestore}>
                    <Undo2 />
                    Restore original attempts
                </Button>
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-1 text-sm">
                <span />
                <span className="text-xs font-semibold text-faint">
                    Original
                </span>
                {sorted.map((attempt) => (
                    <div key={attempt.id} className="contents">
                        <span className="text-muted-foreground">
                            {attemptLabel(attempt)}
                        </span>
                        <span>
                            {byId.get(attempt.id)?.addedByRuling
                                ? "Not done"
                                : attemptWithPenaltyToString({
                                      ...attempt,
                                      penalty:
                                          byId.get(attempt.id)
                                              ?.penaltyBeforeDnf ?? 0,
                                  })}
                        </span>
                    </div>
                ))}
            </div>
            {ruling.removedResults.length > 0 && (
                <p className="text-sm text-muted-foreground">
                    Also removed (Regulation 9t):{" "}
                    {ruling.removedResults.map((removed, index) => (
                        <span key={removed.id}>
                            {index > 0 && ", "}
                            <Link
                                to={`/results/${removed.id}`}
                                className="text-primary hover:underline"
                            >
                                {shortRoundName(removed.roundId)}
                            </Link>
                        </span>
                    ))}
                </p>
            )}
        </section>
    );
};

export default DnfRulingCard;
