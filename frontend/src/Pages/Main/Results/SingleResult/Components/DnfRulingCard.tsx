import { Undo2 } from "lucide-react";

import { Button } from "@/Components/ui/button";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import { restoreDnfAttempts } from "@/lib/attempt";
import { Attempt, AttemptType } from "@/lib/interfaces";
import { attemptWithPenaltyToString } from "@/lib/resultFormatters";

const attemptLabel = (attempt: Attempt) =>
    attempt.type === AttemptType.EXTRA_ATTEMPT
        ? `Extra ${attempt.attemptNumber}`
        : `Attempt ${attempt.attemptNumber}`;

interface DnfRulingCardProps {
    resultId: string;
    /** Attempts a delegate ruled DNF, still holding their own penalty */
    attempts: Attempt[];
    onRestored: () => void;
}

/** Attempts ruled DNF next to their own time, with a way back */
const DnfRulingCard = ({
    resultId,
    attempts,
    onRestored,
}: DnfRulingCardProps) => {
    const confirm = useConfirm();
    const { toast } = useToast();

    const handleRestore = () =>
        confirm({
            title: "Restore the original attempts?",
            description:
                "Each attempt gets back its own time and penalty, and the scorecard is sent again.",
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

    const sorted = [...attempts].sort(
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
                            {attemptWithPenaltyToString({
                                ...attempt,
                                penalty: attempt.penaltyBeforeDnf ?? 0,
                            })}
                        </span>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default DnfRulingCard;
