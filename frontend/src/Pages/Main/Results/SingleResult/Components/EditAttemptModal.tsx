import { useState } from "react";
import { TimeLimit } from "wcif-helpers";

import { Modal } from "@/Components/Modal";
import { useToast } from "@/hooks/useToast";
import { updateAttempt } from "@/lib/attempt";
import { Attempt, AttemptData, Result } from "@/lib/interfaces";
import { milisecondsToClockFormat } from "@/lib/resultFormatters";
import { getSubmissionPlatformName } from "@/lib/utils";

import AttemptForm from "../../Components/AttemptForm";

interface EditAttemptModalProps {
    isOpen: boolean;
    onClose: () => void;
    attempt: Attempt;
    result: Result;
    timeLimit?: TimeLimit;
}

const EditAttemptModal = ({
    isOpen,
    onClose,
    attempt,
    result,
    timeLimit,
}: EditAttemptModalProps) => {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [submitError, setSubmitError] = useState("");

    const submissionPlatform = getSubmissionPlatformName(result.eventId);

    const handleSubmit = async (data: AttemptData) => {
        setIsLoading(true);
        setSubmitError("");
        const { status, message } = await updateAttempt({
            ...attempt,
            ...data,
        });
        setIsLoading(false);
        if (status === 200) {
            toast({
                title: "Attempt updated",
                description: `Resubmitted to ${submissionPlatform}`,
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
            title="Edit attempt"
            className="max-h-[90dvh] overflow-y-auto sm:max-w-[560px]"
        >
            {(attempt.inspectionTime || attempt.originalTime) && (
                <p className="text-[13px] text-muted-foreground">
                    {[
                        attempt.originalTime &&
                            `Stackmat ${milisecondsToClockFormat(attempt.originalTime)}`,
                        attempt.inspectionTime &&
                            `Inspection ${milisecondsToClockFormat(attempt.inspectionTime)}`,
                    ]
                        .filter(Boolean)
                        .join(" · ")}
                </p>
            )}
            <AttemptForm
                handleSubmit={handleSubmit}
                onCancel={onClose}
                isLoading={isLoading}
                submitError={submitError}
                attempt={attempt}
                competitorId={result.person.id}
                timeLimit={timeLimit}
                roundId={result.roundId}
            />
        </Modal>
    );
};
export default EditAttemptModal;
