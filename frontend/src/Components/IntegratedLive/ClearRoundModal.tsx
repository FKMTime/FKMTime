import { useState } from "react";

import { Modal } from "@/Components/Modal";
import ModalActions from "@/Components/ModalActions";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { useDialogError } from "@/hooks/useDialogError";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName } from "@/lib/activities";
import {
    clearIntegratedLiveRound,
    invalidateIntegratedLiveRounds,
} from "@/lib/integratedLive";

interface ClearRoundModalProps {
    isOpen: boolean;
    onClose: () => void;
    roundId: string;
}

/**
 * Empties every result of the round in WCA Integrated Live Results, then
 * FKMTime sends its own results again. For when the WCA holds something
 * nobody can explain, e.g. results typed in by hand (SPEC-006 section 5).
 */
const ClearRoundModal = ({
    isOpen,
    onClose,
    roundId,
}: ClearRoundModalProps) => {
    const [error, setError] = useDialogError(isOpen);
    const { toast } = useToast();
    const [typed, setTyped] = useState("");
    const [isClearing, setIsClearing] = useState(false);
    const name = activityCodeToName(roundId);

    const clear = async () => {
        setIsClearing(true);
        const { ok, message } = await clearIntegratedLiveRound(roundId);
        setIsClearing(false);
        if (!ok) {
            setError(message);
            return;
        }
        toast({
            title: `${name} cleared; FKMTime is sending its results again`,
            variant: "success",
        });
        void invalidateIntegratedLiveRounds();
        setTyped("");
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Clear ${name} in WCA Integrated Live Results?`}
            error={error}
        >
            <div className="flex flex-col gap-3 text-sm">
                <p>
                    Every result of this round on the WCA website is emptied.
                    FKMTime then sends its own results again, so the WCA ends up
                    matching FKMTime. Anything typed in by hand there is lost.
                </p>
                <label className="flex flex-col gap-1">
                    Type <code>{roundId}</code> to confirm
                    <Input
                        value={typed}
                        onChange={(event) => setTyped(event.target.value)}
                        autoComplete="off"
                    />
                </label>
                <ModalActions>
                    <Button
                        variant="destructive"
                        onClick={clear}
                        disabled={typed !== roundId || isClearing}
                    >
                        Clear round
                    </Button>
                </ModalActions>
            </div>
        </Modal>
    );
};

export default ClearRoundModal;
