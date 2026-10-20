import { useState } from "react";

import { Modal } from "@/Components/Modal";
import { useDialogError } from "@/hooks/useDialogError";
import { QuickActionData } from "@/lib/interfaces";
import { createQuickAction } from "@/lib/quickActions";

import QuickActionForm from "./QuickActionForm";

interface CreateQuickActionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CreateQuickActionModal = ({
    isOpen,
    onClose,
}: CreateQuickActionModalProps) => {
    const [error, setError] = useDialogError(isOpen);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (data: QuickActionData) => {
        setIsLoading(true);
        const status = await createQuickAction(data);
        if (status === 201) {
            onClose();
        } else {
            setError("Something went wrong");
        }
        setIsLoading(false);
    };

    return (
        <Modal
            error={error}
            isOpen={isOpen}
            onClose={onClose}
            title="Create quick action"
        >
            <QuickActionForm
                handleSubmit={handleSubmit}
                isLoading={isLoading}
            />
        </Modal>
    );
};

export default CreateQuickActionModal;
