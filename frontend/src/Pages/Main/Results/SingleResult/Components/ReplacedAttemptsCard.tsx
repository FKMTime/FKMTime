import { useState } from "react";

import SegmentedControl from "@/Components/shared/SegmentedControl";
import { useToast } from "@/hooks/useToast";
import {
    ExtraGrantState,
    reapplyExtraGrant,
    restoreExtraGrant,
} from "@/lib/attempt";
import { Attempt, AttemptStatus, AttemptType } from "@/lib/interfaces";
import { attemptWithPenaltyToString } from "@/lib/resultFormatters";
import { cn } from "@/lib/utils";

const extraNumbered = (attempts: Attempt[], number: number) =>
    attempts.find(
        (attempt) =>
            attempt.type === AttemptType.EXTRA_ATTEMPT &&
            attempt.attemptNumber === number
    );

/** The redo of an attempt, whichever set counts right now */
const getRedo = (attempt: Attempt, attempts: Attempt[]) => {
    const number = attempt.replacedBy || attempt.replacedByInGrant;
    let redo = number ? extraNumbered(attempts, number) : undefined;
    while (redo?.replacedBy) {
        const next = extraNumbered(attempts, redo.replacedBy);
        if (!next || next === redo) break;
        redo = next;
    }
    return redo;
};

const attemptLabel = (attempt: Attempt) =>
    attempt.type === AttemptType.EXTRA_ATTEMPT
        ? `Extra ${attempt.attemptNumber}`
        : `Attempt ${attempt.attemptNumber}`;

const redoText = (attempt: Attempt, attempts: Attempt[]) => {
    const redo = getRedo(attempt, attempts);
    if (redo) {
        return `E${redo.attemptNumber}: ${attemptWithPenaltyToString(redo)}`;
    }
    return [attempt.status, attempt.statusInGrant].includes(
        AttemptStatus.VOIDED
    )
        ? "Not needed"
        : "Not done yet";
};

interface ReplacedAttemptsCardProps {
    attempts: Attempt[];
    grant: ExtraGrantState;
    onSwitched: () => void;
}

/** The replaced attempts next to their redo, and which of the two counts */
const ReplacedAttemptsCard = ({
    attempts,
    grant,
    onSwitched,
}: ReplacedAttemptsCardProps) => {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const replaced = attempts
        .filter((attempt) => grant.attemptIds.includes(attempt.id))
        .sort(
            (a, b) =>
                a.type.localeCompare(b.type) * -1 ||
                a.attemptNumber - b.attemptNumber
        );

    const handleSwitch = async (counting: "originals" | "extras") => {
        if ((counting === "originals") === grant.usingOriginals) return;
        setIsSaving(true);
        const { status, message } =
            counting === "originals"
                ? await restoreExtraGrant(grant.id)
                : await reapplyExtraGrant(grant.id);
        setIsSaving(false);
        if (status === 200) {
            toast({
                title:
                    counting === "originals"
                        ? "Now counting the original attempts"
                        : "Now counting the extras",
                variant: "success",
            });
            onSwitched();
        } else {
            toast({
                title: "Error",
                description: message ?? "Something went wrong",
                variant: "destructive",
            });
        }
    };

    const columnClass = (counts: boolean) =>
        cn(counts ? "font-semibold" : "text-faint");

    return (
        <section
            aria-label="Replaced attempts"
            className="flex flex-col gap-3 rounded-mobile-card border bg-card px-5 py-[18px] md:rounded-2xl"
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">Replaced attempts</h3>
                <div className="flex items-center gap-2.5">
                    <span className="text-[13px] text-muted-foreground">
                        Counting
                    </span>
                    <SegmentedControl
                        label="Counting"
                        value={grant.usingOriginals ? "originals" : "extras"}
                        onValueChange={(value) =>
                            !isSaving && handleSwitch(value)
                        }
                        options={[
                            { value: "originals" as const, label: "Originals" },
                            { value: "extras" as const, label: "Extras" },
                        ]}
                    />
                </div>
            </div>
            <div className="grid grid-cols-[auto_auto_1fr] gap-x-8 gap-y-1 text-sm">
                <span />
                <span className="text-xs font-semibold text-faint">
                    Original
                </span>
                <span className="text-xs font-semibold text-faint">Redo</span>
                {replaced.map((attempt) => (
                    <div key={attempt.id} className="contents">
                        <span className="text-muted-foreground">
                            {attemptLabel(attempt)}
                        </span>
                        <span className={columnClass(grant.usingOriginals)}>
                            {attemptWithPenaltyToString(attempt)}
                        </span>
                        <span className={columnClass(!grant.usingOriginals)}>
                            {redoText(attempt, attempts)}
                        </span>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default ReplacedAttemptsCard;
