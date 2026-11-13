import { useCallback, useEffect, useState } from "react";

import GroupPlacement from "@/Components/IntegratedLive/GroupPlacement";
import { Modal } from "@/Components/Modal";
import { Button } from "@/Components/ui/button";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName } from "@/lib/activities";
import {
    invalidateIntegratedLiveRounds,
    openIntegratedLiveRound,
    previewWithdrawal,
    withdrawFromRound,
} from "@/lib/integratedLive";
import {
    IntegratedLiveNextInLine,
    IntegratedLiveWithdrawalPreview,
    IntegratedLiveWithdrawalResult,
} from "@/lib/interfaces";

interface WithdrawFromRoundModalProps {
    isOpen: boolean;
    onClose: () => void;
    roundId: string;
    personId: string;
}

const names = (people: IntegratedLiveNextInLine[]) =>
    people
        .map((p) => p.name ?? `registration ${p.registrationId}`)
        .join(" and ");

/**
 * A competitor withdraws from a later round (Regulation 9p3). The WCA says
 * who is next in line; the person chooses whether they advance. FKMTime never
 * picks for them (SPEC-006 section 4).
 */
const WithdrawFromRoundModal = ({
    isOpen,
    onClose,
    roundId,
    personId,
}: WithdrawFromRoundModalProps) => {
    const { toast } = useToast();
    const [preview, setPreview] =
        useState<IntegratedLiveWithdrawalPreview | null>(null);
    const [done, setDone] = useState<IntegratedLiveWithdrawalResult | null>(
        null
    );
    const [notice, setNotice] = useState("");
    const [isBusy, setIsBusy] = useState(false);
    const roundName = activityCodeToName(roundId);

    const load = useCallback(async () => {
        setPreview(null);
        setPreview(await previewWithdrawal(roundId, personId));
    }, [roundId, personId]);

    // Mounted fresh for each competitor, so only the preview needs loading
    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        previewWithdrawal(roundId, personId).then((loaded) => {
            if (!cancelled) setPreview(loaded);
        });
        return () => {
            cancelled = true;
        };
    }, [isOpen, roundId, personId]);

    const openRound = async () => {
        setIsBusy(true);
        const { ok, message } = await openIntegratedLiveRound(roundId);
        setIsBusy(false);
        if (!ok) {
            setNotice(message);
            return;
        }
        void invalidateIntegratedLiveRounds();
        await load();
    };

    const withdraw = async (advancing: IntegratedLiveNextInLine[]) => {
        setIsBusy(true);
        setNotice("");
        const result = await withdrawFromRound(
            roundId,
            personId,
            advancing.map((p) => p.registrationId)
        );
        setIsBusy(false);
        if (result.changed && preview) {
            // Never send a replacement the person didn't see
            setPreview({ ...preview, next: result.next ?? [] });
            setNotice("Who is next in line changed. Choose again.");
            return;
        }
        if (!result.ok) {
            setNotice(result.message);
            return;
        }
        void invalidateIntegratedLiveRounds();
        toast({ title: result.message, variant: "success" });
        setDone(result);
    };

    const next = preview?.next ?? [];

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Remove from ${roundName}`}
        >
            <div className="flex flex-col gap-3 text-sm">
                {!preview && <p>Asking the WCA who is next in line…</p>}

                {preview && !preview.ok && <p>{preview.message}</p>}

                {preview?.ok && !preview.roundOpen && !done && (
                    <>
                        <p>
                            {roundName} isn't open in WCA Integrated Live
                            Results yet, and the WCA only knows who is in it
                            once it is open.
                        </p>
                        <p>
                            Opening it locks the round before it: corrections
                            there will no longer change who advances.
                        </p>
                        {preview.roundState === "ready" && (
                            <Button onClick={openRound} disabled={isBusy}>
                                Open {roundName} first
                            </Button>
                        )}
                    </>
                )}

                {preview?.ok && preview.roundOpen && !done && (
                    <>
                        <p>
                            {preview.name} withdraws from {roundName}.{" "}
                            {next.length > 0
                                ? `Next in line: ${names(next)}.`
                                : "Nobody is next in line."}
                        </p>
                        {next.length === 0 && preview.nobodyReason && (
                            <p className="text-muted-foreground">
                                {preview.nobodyReason}
                            </p>
                        )}
                        {next.length > 1 && (
                            <p className="text-muted-foreground">
                                The WCA only accepts everyone it names or
                                nobody, so they can't be split.
                            </p>
                        )}
                        <p className="text-muted-foreground">
                            Once the round is closed, a removed competitor can't
                            be added back.
                        </p>
                        <div className="flex flex-col gap-2">
                            {next.length > 0 && (
                                <Button
                                    onClick={() => withdraw(next)}
                                    disabled={isBusy}
                                >
                                    Withdraw,{" "}
                                    {next.length === 1
                                        ? `${names(next)} advances`
                                        : next.length === 2
                                          ? "both advance"
                                          : "all of them advance"}
                                </Button>
                            )}
                            <Button
                                variant={
                                    next.length > 0 ? "outline" : "default"
                                }
                                onClick={() => withdraw([])}
                                disabled={isBusy}
                            >
                                {next.length > 0
                                    ? "Withdraw, nobody advances"
                                    : "Withdraw"}
                            </Button>
                        </div>
                    </>
                )}

                {done && (
                    <>
                        <p>{done.message}.</p>
                        {(done.replacements ?? []).map((replacement) => (
                            <GroupPlacement
                                key={replacement.personId}
                                roundId={roundId}
                                personId={replacement.personId}
                                name={replacement.name}
                                suggestedGroupId={replacement.suggestedGroupId}
                            />
                        ))}
                        <Button variant="outline" onClick={onClose}>
                            Done
                        </Button>
                    </>
                )}

                {notice && <p className="text-destructive">{notice}</p>}
            </div>
        </Modal>
    );
};

export default WithdrawFromRoundModal;
