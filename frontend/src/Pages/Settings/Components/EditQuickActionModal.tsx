import { useToast } from "@chakra-ui/react";
import { useState } from "react";

import { Modal } from "@/Components/Modal";
import { QuickAction } from "@/logic/interfaces.ts";
import { updateQuickAction } from "@/logic/quickActions.ts";

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
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (data: QuickAction) => {
        setIsLoading(true);
        const status = await updateQuickAction(data);
        if (status === 200) {
            toast({
                title: "Success",
                description: "Quick action has been updated successfully.",
                status: "success",
            });
            onClose();
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                status: "error",
            });
        }
        setIsLoading(false);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Update quick action">
            <QuickActionForm
                quickAction={quickAction}
                handleSubmit={handleSubmit}
                handleCancel={onClose}
                isLoading={isLoading}
            />
        </Modal>
    );
};

export default EditQuickActionModal;
