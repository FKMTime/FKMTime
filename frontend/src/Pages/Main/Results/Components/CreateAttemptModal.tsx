import { TimeLimit } from "@wca/helpers";
import { useState } from "react";

import { Modal } from "@/Components/Modal";
import { useToast } from "@/hooks/useToast";
import { createAttempt } from "@/lib/attempt";
import { AttemptData } from "@/lib/interfaces";
import { getSubmissionPlatformName } from "@/lib/utils";

import AttemptForm from "./AttemptForm";

interface CreateAttemptModalProps {
    isOpen: boolean;
    onClose: () => void;
    roundId: string;
    competitorId?: string;
    timeLimit?: TimeLimit;
}

const CreateAttemptModal = ({
    isOpen,
    onClose,
    roundId,
    competitorId,
    timeLimit,
}: CreateAttemptModalProps) => {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const submissionPlatform = getSubmissionPlatformName(roundId.split("-")[0]);

    const onSubmit = async (data: AttemptData) => {
        setIsLoading(true);
        const status = await createAttempt(data);
        if (status === 201) {
            toast({
                title: `Attempt created and submitted to ${submissionPlatform}`,
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
        setIsLoading(false);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Enter attempt">
            <div className="max-h-96 overflow-y-auto">
                <AttemptForm
                    handleSubmit={onSubmit}
                    isLoading={isLoading}
                    competitorId={competitorId}
                    roundId={roundId}
                    timeLimit={timeLimit}
                />
            </div>
        </Modal>
    );
};

export default CreateAttemptModal;
