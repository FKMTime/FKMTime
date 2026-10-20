import { useState } from "react";
import { TimeLimit } from "wcif-helpers";

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
    const [submitError, setSubmitError] = useState("");

    const submissionPlatform = getSubmissionPlatformName(roundId.split("-")[0]);

    const onSubmit = async (data: AttemptData) => {
        setIsLoading(true);
        setSubmitError("");
        const { status, message } = await createAttempt(data);
        setIsLoading(false);
        if (status === 201) {
            toast({
                title: "Attempt saved",
                description: `Submitted to ${submissionPlatform}`,
                variant: "success",
            });
            onClose();
        } else {
            setSubmitError(message ?? "The attempt could not be saved.");
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Enter attempt"
            className="max-h-[90dvh] overflow-y-auto sm:max-w-[560px]"
        >
            <AttemptForm
                handleSubmit={onSubmit}
                onCancel={onClose}
                isLoading={isLoading}
                submitError={submitError}
                competitorId={competitorId}
                roundId={roundId}
                timeLimit={timeLimit}
            />
        </Modal>
    );
};

export default CreateAttemptModal;
