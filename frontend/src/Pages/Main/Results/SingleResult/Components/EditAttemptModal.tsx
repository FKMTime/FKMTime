import { TimeLimit } from "@wca/helpers";
import { useState } from "react";

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

    const submissionPlatform = getSubmissionPlatformName(result.eventId);

    const handleSubmit = async (data: AttemptData) => {
        setIsLoading(true);
        const status = await updateAttempt({
            ...attempt,
            ...data,
        });
        if (status === 200) {
            toast({
                title: `Successfully updated attempt and resubmitted result to ${submissionPlatform}.`,
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
        <Modal isOpen={isOpen} onClose={onClose} title="Edit attempt">
            <div className="max-h-96 overflow-y-auto">
                {attempt.inspectionTime ? (
                    <p>
                        Inspection time:{" "}
                        {milisecondsToClockFormat(attempt.inspectionTime)}
                    </p>
                ) : null}
                {attempt.originalTime ? (
                    <p>
                        Original time:{" "}
                        {milisecondsToClockFormat(attempt.originalTime)}
                    </p>
                ) : null}
                <AttemptForm
                    handleSubmit={handleSubmit}
                    isLoading={isLoading}
                    attempt={attempt}
                    competitorId={result.person.id}
                    timeLimit={timeLimit}
                    roundId={result.roundId}
                />
            </div>
        </Modal>
    );
};
export default EditAttemptModal;
