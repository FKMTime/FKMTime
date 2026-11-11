import { useAtomValue } from "jotai";
import { FormEvent, useState } from "react";
import { getNumberOfAttemptsForRound } from "wcif-helpers";

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
import { DNF_VALUE, DNS_VALUE } from "@/lib/constants";
import {
    ApplicationQuickAction,
    Attempt,
    SendingResultsFrequency,
} from "@/lib/interfaces";
import { attemptWithPenaltyToString } from "@/lib/resultFormatters";
import {
    getAttemptsToDnf,
    getSubmittedAttempts,
    hasRemainingAttempts,
    shortRoundName,
} from "@/lib/utils";

type ScopeResult = { id: string; roundId: string; attempts: Attempt[] };

const roundNumber = (roundId: string) => +roundId.split("-r")[1];

const isDnfOrDns = (attempt: Attempt) =>
    attempt.penalty === DNF_VALUE || attempt.penalty === DNS_VALUE;

interface DnfAttemptsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDone: () => void;
    personName: string;
    /** One round, or every round of an event, in round order */
    results: ScopeResult[];
    /** Every result the competitor has in the event, for Regulation 9t */
    eventResults?: ScopeResult[];
}

/** Rule a competitor's attempts DNF, in one round or across an event */
const DnfAttemptsModal = ({
    isOpen,
    onClose,
    onDone,
    personName,
    results,
    eventResults = results,
}: DnfAttemptsModalProps) => {
    const competition = useAtomValue(competitionAtom);
    const { toast } = useToast();
    const [error, setError] = useDialogError(isOpen);
    const [isLoading, setIsLoading] = useState(false);
    const [comment, setComment] = useState("");
    const [uncheckedIds, setUncheckedIds] = useState<string[]>([]);
    const [disqualify, setDisqualify] = useState(false);
    const [chosenRemoveLater, setChosenRemoveLater] = useState<boolean | null>(
        null
    );
    const isTicked = (attempt: Attempt) => !uncheckedIds.includes(attempt.id);

    const allRounds = results.map((result) => ({
        result,
        attempts: getAttemptsToDnf(result.attempts),
    }));
    const lastResult = results.at(-1);
    // The earliest round this ruling changes; later rounds go whole (9t)
    const firstChanged =
        allRounds.find((round) => round.attempts.some(isTicked))?.result ??
        lastResult;
    const laterResults = firstChanged
        ? eventResults.filter(
              (other) =>
                  roundNumber(other.roundId) > roundNumber(firstChanged.roundId)
          )
        : [];
    // Regulation 9p4: with only DNF and DNS left, they can't have advanced
    const leavesOnlyDnf =
        !!firstChanged &&
        getSubmittedAttempts(firstChanged.attempts).every(
            (attempt) => isDnfOrDns(attempt) || isTicked(attempt)
        );
    const removeLater =
        laterResults.length > 0 && (chosenRemoveLater ?? leavesOnlyDnf);

    const rounds = allRounds.filter(
        (round) =>
            round.attempts.length > 0 &&
            (!removeLater ||
                roundNumber(round.result.roundId) <=
                    roundNumber(firstChanged!.roundId))
    );
    const chosen = rounds.flatMap((round) => round.attempts).filter(isTicked);
    const showRoundNames = rounds.length > 1;
    // A disqualification applies to the round in progress: the last one that stays
    const stayingResult = removeLater ? firstChanged : lastResult;
    const { data: context } = useLiveQuery(
        extrasContextQuery(stayingResult?.id ?? ""),
        { enabled: isOpen && !!stayingResult }
    );
    const canDisqualify =
        !!stayingResult &&
        !!competition &&
        hasRemainingAttempts(
            stayingResult.attempts,
            getNumberOfAttemptsForRound(stayingResult.roundId, competition.wcif)
        );
    const disqualifies = canDisqualify && disqualify;

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
            remainingInResultId: disqualifies ? stayingResult?.id : undefined,
            removeLaterRounds: removeLater,
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
                        key={round.result.roundId}
                        className="flex flex-col gap-2"
                    >
                        <legend className="mb-1 text-sm font-medium">
                            {showRoundNames
                                ? shortRoundName(round.result.roundId)
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
                {canDisqualify && stayingResult && (
                    <Label className="flex min-h-11 cursor-pointer items-center gap-3 font-normal md:min-h-0">
                        <Checkbox
                            checked={disqualify}
                            onCheckedChange={(value) => setDisqualify(!!value)}
                        />
                        DNF all remaining attempts in{" "}
                        {shortRoundName(stayingResult.roundId)}
                    </Label>
                )}
                {laterResults.length > 0 && (
                    <div className="flex flex-col gap-1">
                        <Label className="flex min-h-11 cursor-pointer items-center gap-3 font-normal md:min-h-0">
                            <Checkbox
                                checked={removeLater}
                                onCheckedChange={(value) =>
                                    setChosenRemoveLater(!!value)
                                }
                            />
                            Remove results in later rounds (Regulation 9t):{" "}
                            {laterResults
                                .map((later) => shortRoundName(later.roundId))
                                .join(", ")}
                        </Label>
                        <p className="text-[13px] text-muted-foreground">
                            {leavesOnlyDnf
                                ? `With only DNF results, ${personName} can't advance.`
                                : `Tick if ${personName} would no longer have advanced.`}
                        </p>
                    </div>
                )}
                {removeLater && (
                    <p className="text-sm text-muted-foreground">
                        {sendsToLive
                            ? `Their results in these rounds are emptied in WCA Live, which then counts them as not competed and drops them when the next round opens.`
                            : `Results aren't sent to WCA Live in this competition, so remove ${personName} from these rounds there.`}
                    </p>
                )}
                {disqualifies && (
                    <p className="text-sm text-muted-foreground">
                        {personName} is disqualified from the round and can't do
                        any more attempts. Completed attempts stay as they are
                        unless ticked above.
                    </p>
                )}
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
                    disabled={isLoading || (!chosen.length && !disqualifies)}
                >
                    Set to DNF
                </Button>
            </form>
        </Modal>
    );
};

export default DnfAttemptsModal;
