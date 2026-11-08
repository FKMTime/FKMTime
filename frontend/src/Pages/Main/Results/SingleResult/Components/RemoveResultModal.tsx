import { useAtomValue } from "jotai";
import { FormEvent, useState } from "react";

import { Modal } from "@/Components/Modal.tsx";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import { useDialogError } from "@/hooks/useDialogError";
import { useToast } from "@/hooks/useToast";
import { competitionAtom } from "@/lib/atoms";
import { SendingResultsFrequency } from "@/lib/interfaces";
import { removeResult } from "@/lib/results";
import { shortRoundName } from "@/lib/utils";

interface RemoveResultModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDone: () => void;
    resultId: string;
    roundId: string;
    personName: string;
}

/** Regulation 9t: the competitor would not have reached this round */
const RemoveResultModal = ({
    isOpen,
    onClose,
    onDone,
    resultId,
    roundId,
    personName,
}: RemoveResultModalProps) => {
    const competition = useAtomValue(competitionAtom);
    const { toast } = useToast();
    const [error, setError] = useDialogError(isOpen);
    const [isLoading, setIsLoading] = useState(false);
    const [reason, setReason] = useState("");

    const onSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError("");
        setIsLoading(true);
        const { status, message } = await removeResult(resultId, reason);
        setIsLoading(false);
        if (status === 200) {
            toast({ title: "Result removed", variant: "success" });
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
            title="Remove from this round"
        >
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                    Under Regulation 9t, {personName} would not have reached{" "}
                    {shortRoundName(roundId)}. The result is kept with its
                    attempts but counts nowhere, and can be brought back from
                    this page.
                </p>
                <div className="flex flex-col gap-2">
                    <Label htmlFor="remove-reason">Reason</Label>
                    <Input
                        id="remove-reason"
                        placeholder="Score-taking mistake in the previous round"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                    />
                </div>
                <p className="text-sm font-medium">
                    {sendsToLive ? "Their times are cleared in WCA Live. " : ""}
                    Remove {personName} from this round in WCA Live too.
                </p>
                <Button
                    type="submit"
                    variant="destructive"
                    disabled={isLoading}
                >
                    Remove result
                </Button>
            </form>
        </Modal>
    );
};

export default RemoveResultModal;
