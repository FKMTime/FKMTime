import { useState } from "react";

import { Modal } from "@/Components/Modal";
import { useDialogError } from "@/hooks/useDialogError";
import { QuickAction, QuickActionData } from "@/lib/interfaces";
import { updateQuickAction } from "@/lib/quickActions";

import QuickActionForm from "./QuickActionForm";

interface EditQuickActionModalProps {
    isOpen: boolean;
    onClose: () => void;
    quickAction: QuickAction;
}

const EditQuickActionModal = ({
    isOpen,
    onClose,
    quickAction,
}: EditQuickActionModalProps) => {
    const [error, setError] = useDialogError(isOpen);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (data: QuickActionData) => {
        setIsLoading(true);
        const status = await updateQuickAction({
            ...quickAction,
            ...data,
        });
        if (status === 200) {
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
            title="Update quick action"
        >
            <QuickActionForm
                quickAction={quickAction}
                handleSubmit={handleSubmit}
                isLoading={isLoading}
            />
        </Modal>
    );
};

export default EditQuickActionModal;
