import { useAtomValue } from "jotai";
import { FormEvent, useEffect, useState } from "react";
import { getNumberOfAttemptsForRound } from "wcif-helpers";

import { Modal } from "@/Components/Modal.tsx";
import QuickActions from "@/Components/QuickActions";
import SegmentedControl from "@/Components/shared/SegmentedControl";
import { Button } from "@/Components/ui/button";
import { Checkbox } from "@/Components/ui/checkbox";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import { useDialogError } from "@/hooks/useDialogError";
import { useToast } from "@/hooks/useToast";
import { competitionAtom } from "@/lib/atoms";
import { ExtrasContext, getExtrasContext, giveExtras } from "@/lib/attempt";
import {
    ApplicationQuickAction,
    Attempt,
    AttemptType,
    SendingResultsFrequency,
} from "@/lib/interfaces";
import { attemptWithPenaltyToString } from "@/lib/resultFormatters";
import { getSubmittedAttempts } from "@/lib/utils";

/** From this many attempts a redo usually moves to a fresh scramble set */
const FRESH_SET_FROM_ATTEMPTS = 3;

const joinNumbers = (numbers: number[]) =>
    numbers.length < 2
        ? numbers.join("")
        : `${numbers.slice(0, -1).join(", ")} and ${numbers.at(-1)}`;

interface GiveExtrasModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDone: () => void;
    resultId: string;
    roundId: string;
    personName: string;
    attempts: Attempt[];
    /** An open incident always gets its extra, on top of what is ticked */
    lockedAttempt?: Attempt;
    /** Runs first; returns what went wrong, if anything */
    beforeGrant?: (comment: string) => Promise<string | undefined>;
}

/** Give a competitor extras for several attempts in one go */
const GiveExtrasModal = ({
    isOpen,
    onClose,
    onDone,
    resultId,
    roundId,
    personName,
    attempts,
    lockedAttempt,
    beforeGrant,
}: GiveExtrasModalProps) => {
    const competition = useAtomValue(competitionAtom);
    const { toast } = useToast();
    const [error, setError] = useDialogError(isOpen);
    const [isLoading, setIsLoading] = useState(false);
    const [context, setContext] = useState<ExtrasContext | null>(null);
    const [comment, setComment] = useState(lockedAttempt?.comment ?? "");
    const [uncheckedIds, setUncheckedIds] = useState<string[]>([]);
    const [chosenFreshSet, setChosenFreshSet] = useState<boolean | null>(null);
    const [removeFromLive, setRemoveFromLive] = useState(true);

    useEffect(() => {
        if (isOpen) getExtrasContext(resultId).then(setContext);
    }, [isOpen, resultId]);

    const countingAttempts = getSubmittedAttempts(attempts) as (Attempt & {
        number: number;
    })[];
    const chosen = countingAttempts.filter(
        (attempt) => !uncheckedIds.includes(attempt.id)
    );
    const positions = [
        ...chosen.map((attempt) => attempt.number),
        ...(lockedAttempt ? [lockedAttempt.attemptNumber] : []),
    ].sort((a, b) => a - b);
    const useFreshSet =
        chosenFreshSet ?? positions.length >= FRESH_SET_FROM_ATTEMPTS;

    const maxAttempts = competition
        ? getNumberOfAttemptsForRound(roundId, competition.wcif)
        : 0;
    const lastAttemptNumber = Math.max(
        0,
        ...attempts
            .filter((a) => a.type === AttemptType.STANDARD_ATTEMPT)
            .map((a) => a.attemptNumber)
    );
    const nextAttempt =
        lastAttemptNumber < maxAttempts ? lastAttemptNumber + 1 : null;

    const handleQuickAction = (action: ApplicationQuickAction) =>
        setComment(action.comment ?? "");

    const toggle = (id: string, checked: boolean) =>
        setUncheckedIds((ids) =>
            checked ? ids.filter((i) => i !== id) : [...ids, id]
        );

    const onSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError("");
        setIsLoading(true);
        const failure = await beforeGrant?.(comment);
        if (failure) {
            setIsLoading(false);
            return setError(failure);
        }
        const { status, message } = await giveExtras({
            resultId,
            attemptIds: chosen.map((attempt) => attempt.id),
            comment,
            useFreshSet,
            removeFromLive: canRemoveFromLive && removeFromLive,
        });
        setIsLoading(false);
        if (status === 200) {
            toast({ title: "Extras granted", variant: "success" });
            onDone();
        } else {
            setError(message ?? "Something went wrong");
        }
    };

    const canRemoveFromLive =
        competition?.sendingResultsFrequency !== SendingResultsFrequency.NEVER;

    return (
        <Modal
            error={error}
            isOpen={isOpen}
            onClose={onClose}
            title="Give extras for several attempts"
        >
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                    <QuickActions handleQuickAction={handleQuickAction} />
                </div>
                <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1 text-sm font-medium">
                        Attempts to replace
                    </legend>
                    {countingAttempts.map((attempt) => (
                        <Label
                            key={attempt.id}
                            className="flex min-h-11 cursor-pointer items-center gap-3 font-normal md:min-h-0"
                        >
                            <Checkbox
                                checked={!uncheckedIds.includes(attempt.id)}
                                onCheckedChange={(value) =>
                                    toggle(attempt.id, !!value)
                                }
                            />
                            Attempt {attempt.number}:{" "}
                            {attemptWithPenaltyToString(attempt)}
                        </Label>
                    ))}
                    {lockedAttempt && (
                        <Label className="flex min-h-11 items-center gap-3 font-normal md:min-h-0">
                            <Checkbox checked disabled />
                            Attempt {lockedAttempt.attemptNumber}: this incident
                        </Label>
                    )}
                </fieldset>
                {positions.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                        {positions.length === 1 ? "Attempt" : "Attempts"}{" "}
                        {joinNumbers(positions)} will no longer count.{" "}
                        {personName} redoes{" "}
                        {positions.length === 1 ? "it" : "them"}
                        {nextAttempt
                            ? `, then continues from attempt ${nextAttempt}.`
                            : "."}
                    </p>
                )}
                <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium">Scrambles</span>
                    <SegmentedControl
                        label="Scrambles"
                        value={useFreshSet ? "fresh" : "extra"}
                        onValueChange={(value) =>
                            setChosenFreshSet(value === "fresh")
                        }
                        options={[
                            { value: "extra", label: "Extra scrambles" },
                            {
                                value: "fresh",
                                label: "Normal scrambles from a fresh set",
                            },
                        ]}
                    />
                    {!useFreshSet && (
                        <p className="text-[13px] text-muted-foreground">
                            This needs {positions.length} extra{" "}
                            {positions.length === 1 ? "scramble" : "scrambles"}.
                        </p>
                    )}
                    {useFreshSet && context && !context.hasNextGroup && (
                        <p className="text-[13px] text-muted-foreground">
                            There's no later group in this round. Generate a set
                            and add it under Scrambles first.
                        </p>
                    )}
                </div>
                {context?.nextRoundStarted && (
                    <p role="alert" className="text-sm font-medium">
                        The next round has started. Stations can't take these
                        attempts, and any change to who advanced must be made in
                        WCA Live.
                    </p>
                )}
                <div className="flex flex-col gap-2">
                    <Label htmlFor="extras-comment">Comment</Label>
                    <Input
                        id="extras-comment"
                        placeholder="Comment"
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                    />
                </div>
                {canRemoveFromLive && (
                    <Label className="flex min-h-11 cursor-pointer items-center gap-3 font-normal md:min-h-0">
                        <Checkbox
                            checked={removeFromLive}
                            onCheckedChange={(value) =>
                                setRemoveFromLive(!!value)
                            }
                        />
                        Remove these times from WCA Live now
                    </Label>
                )}
                <Button type="submit" disabled={isLoading || !chosen.length}>
                    Give extras
                </Button>
            </form>
        </Modal>
    );
};

export default GiveExtrasModal;
