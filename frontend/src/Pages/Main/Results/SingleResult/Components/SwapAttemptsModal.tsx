import { useState } from "react";

import { Modal } from "@/Components/Modal";
import ModalActions from "@/Components/ModalActions";
import { Button } from "@/Components/ui/button";
import { Label } from "@/Components/ui/label";
import { useDialogError } from "@/hooks/useDialogError";
import { swapAttempts } from "@/lib/attempt";
import { Attempt } from "@/lib/interfaces";

import AttemptSelect from "./AttemptSelect";

interface SwapAttemptsModalProps {
    isOpen: boolean;
    onClose: () => void;
    attempts: Attempt[];
}

const SwapAttemptsModal = ({
    isOpen,
    onClose,
    attempts,
}: SwapAttemptsModalProps) => {
    const [error, setError] = useDialogError(isOpen);
    const [firstAttemptId, setFirstAttemptId] = useState<string>("");
    const [secondAttemptId, setSecondAttemptId] = useState<string>("");

    const handleSubmit = async () => {
        if (firstAttemptId === secondAttemptId) {
            return setError("You can't swap an attempt with itself");
        }
        const status = await swapAttempts(firstAttemptId, secondAttemptId);
        if (status === 200) {
            onClose();
        } else {
            setError("Something went wrong");
        }
    };

    return (
        <Modal
            error={error}
            isOpen={isOpen}
            onClose={onClose}
            title="Swap two attempts"
        >
            <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                    <Label>First attempt</Label>
                    <AttemptSelect
                        value={firstAttemptId}
                        attempts={attempts}
                        onChange={setFirstAttemptId}
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <Label>Second attempt</Label>
                    <AttemptSelect
                        value={secondAttemptId}
                        attempts={attempts}
                        onChange={setSecondAttemptId}
                    />
                </div>
                <ModalActions>
                    <Button onClick={handleSubmit}>Swap attempts</Button>
                </ModalActions>
            </div>
        </Modal>
    );
};

export default SwapAttemptsModal;
