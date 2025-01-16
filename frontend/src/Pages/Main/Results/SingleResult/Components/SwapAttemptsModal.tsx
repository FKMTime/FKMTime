import { useState } from "react";

import { Modal } from "@/Components/Modal";
import ModalActions from "@/Components/ModalActions";
import { Button } from "@/Components/ui/button";
import { Label } from "@/Components/ui/label";
import { useToast } from "@/hooks/useToast";
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
    const { toast } = useToast();
    const [firstAttemptId, setFirstAttemptId] = useState<string>("");
    const [secondAttemptId, setSecondAttemptId] = useState<string>("");

    const handleSubmit = async () => {
        if (firstAttemptId === secondAttemptId) {
            return toast({
                title: "Error",
                description: "You can't swap an attempt with itself",
                variant: "destructive",
            });
        }
        const status = await swapAttempts(firstAttemptId, secondAttemptId);
        if (status === 200) {
            toast({
                title: "Success",
                description: "Attempts swapped successfully",
                variant: "success",
            });
            onClose();
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Swap two attempts">
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
                    <Button onClick={handleSubmit} variant="success">
                        Swap attempts
                    </Button>
                </ModalActions>
            </div>
        </Modal>
    );
};

export default SwapAttemptsModal;
