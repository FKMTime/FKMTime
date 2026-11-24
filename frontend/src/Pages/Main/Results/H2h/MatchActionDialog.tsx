import { ReactNode, useState } from "react";

import { Modal } from "@/Components/Modal";
import { Button } from "@/Components/ui/button";
import { Label } from "@/Components/ui/label";
import { Textarea } from "@/Components/ui/textarea";

export interface MatchActionDialogProps {
    title: string;
    /** What the action does, read before confirming */
    description: ReactNode;
    confirmLabel: string;
    /** Retire and Reopen match can't go without saying why */
    commentRequired?: boolean;
    destructive?: boolean;
    onConfirm: (comment: string) => Promise<{ ok: boolean; message?: string }>;
    onClose: () => void;
}

/**
 * Confirms a delegate's action on a match (Extra granted, Withdraw, Retire,
 * Reopen match) with a comment saying why. Stays open with the backend's
 * message when it is refused.
 */
const MatchActionDialog = ({
    title,
    description,
    confirmLabel,
    commentRequired = false,
    destructive = false,
    onConfirm,
    onClose,
}: MatchActionDialogProps) => {
    const [comment, setComment] = useState("");
    const [error, setError] = useState("");
    const [isBusy, setIsBusy] = useState(false);

    const confirm = async () => {
        if (commentRequired && comment.trim() === "") {
            setError("Say why in the comment.");
            return;
        }
        setIsBusy(true);
        const result = await onConfirm(comment.trim());
        setIsBusy(false);
        if (result.ok) {
            onClose();
        } else {
            setError(result.message ?? "Something went wrong");
        }
    };

    return (
        <Modal isOpen title={title} onClose={onClose} error={error}>
            <div className="flex flex-col gap-4">
                <div className="text-sm text-muted-foreground">
                    {description}
                </div>
                <div className="flex flex-col gap-2">
                    <Label htmlFor="match-action-comment">
                        {commentRequired ? "Comment" : "Comment (optional)"}
                    </Label>
                    <Textarea
                        id="match-action-comment"
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        disabled={isBusy}
                    />
                </div>
                <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-end">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isBusy}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant={destructive ? "destructive" : "default"}
                        onClick={() => void confirm()}
                        disabled={isBusy}
                    >
                        {confirmLabel}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default MatchActionDialog;
