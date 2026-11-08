import { useAtomValue } from "jotai";
import { FormEvent, useState } from "react";

import { Modal } from "@/Components/Modal.tsx";
import QuickActions from "@/Components/QuickActions";
import { Button } from "@/Components/ui/button";
import { Checkbox } from "@/Components/ui/checkbox";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import { useDialogError } from "@/hooks/useDialogError";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useToast } from "@/hooks/useToast";
import { competitionAtom } from "@/lib/atoms";
import { dnfAttempts, extrasContextQuery } from "@/lib/attempt";
import {
    ApplicationQuickAction,
    Attempt,
    SendingResultsFrequency,
} from "@/lib/interfaces";
import { attemptWithPenaltyToString } from "@/lib/resultFormatters";
import { getAttemptsToDnf, shortRoundName } from "@/lib/utils";

interface DnfAttemptsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDone: () => void;
    personName: string;
    /** One round, or every round of an event, in round order */
    results: { id: string; roundId: string; attempts: Attempt[] }[];
}

/** Rule a competitor's attempts DNF, in one round or across an event */
const DnfAttemptsModal = ({
    isOpen,
    onClose,
    onDone,
    personName,
    results,
}: DnfAttemptsModalProps) => {
    const competition = useAtomValue(competitionAtom);
    const { toast } = useToast();
    const [error, setError] = useDialogError(isOpen);
    const [isLoading, setIsLoading] = useState(false);
    const [comment, setComment] = useState("");
    const [uncheckedIds, setUncheckedIds] = useState<string[]>([]);
    const lastResult = results.at(-1);
    const { data: context } = useLiveQuery(
        extrasContextQuery(lastResult?.id ?? ""),
        { enabled: isOpen && !!lastResult }
    );

    const rounds = results
        .map((result) => ({
            roundId: result.roundId,
            attempts: getAttemptsToDnf(result.attempts),
        }))
        .filter((round) => round.attempts.length > 0);
    const chosen = rounds
        .flatMap((round) => round.attempts)
        .filter((attempt) => !uncheckedIds.includes(attempt.id));
    const showRoundNames = rounds.length > 1;

    const toggle = (id: string, checked: boolean) =>
        setUncheckedIds((ids) =>
            checked ? ids.filter((i) => i !== id) : [...ids, id]
        );

    const handleQuickAction = (action: ApplicationQuickAction) =>
        setComment(action.comment ?? "");

    const onSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError("");
        setIsLoading(true);
        const { status, message } = await dnfAttempts({
            attemptIds: chosen.map((attempt) => attempt.id),
            comment,
        });
        setIsLoading(false);
        if (status === 200) {
            toast({ title: "Attempts set to DNF", variant: "success" });
            onDone();
        } else {
            setError(message ?? "Something went wrong");
        }
    };

    const sendsToLive =
        competition?.sendingResultsFrequency !== SendingResultsFrequency.NEVER;

    return (
        <Modal
            error={error}
            isOpen={isOpen}
            onClose={onClose}
            title="DNF all attempts"
        >
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                    <QuickActions handleQuickAction={handleQuickAction} />
                </div>
                {rounds.map((round) => (
                    <fieldset
                        key={round.roundId}
                        className="flex flex-col gap-2"
                    >
                        <legend className="mb-1 text-sm font-medium">
                            {showRoundNames
                                ? shortRoundName(round.roundId)
                                : "Attempts to set to DNF"}
                        </legend>
                        {round.attempts.map((attempt) => (
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
                    </fieldset>
                ))}
                {chosen.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                        {chosen.length === 1
                            ? "This attempt counts"
                            : `These ${chosen.length} attempts count`}{" "}
                        as DNF for {personName}. The times are kept, so the
                        original attempts can be restored from the result page.
                        {sendsToLive && " The scorecard is sent to WCA Live."}
                    </p>
                )}
                {context?.nextRoundStarted && (
                    <p role="alert" className="text-sm font-medium">
                        The next round has started. Any change to who advanced
                        must be made in WCA Live.
                    </p>
                )}
                <div className="flex flex-col gap-2">
                    <Label htmlFor="dnf-comment">Comment</Label>
                    <Input
                        id="dnf-comment"
                        placeholder="Comment"
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                    />
                </div>
                <Button
                    type="submit"
                    variant="destructive"
                    disabled={isLoading || !chosen.length}
                >
                    Set to DNF
                </Button>
            </form>
        </Modal>
    );
};

export default DnfAttemptsModal;
