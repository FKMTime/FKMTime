import { useToast } from "@chakra-ui/react";
import { useState } from "react";

import { Modal } from "@/Components/Modal";
import { QuickAction } from "@/lib/interfaces";
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
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (data: QuickAction) => {
        setIsLoading(true);
        const status = await updateQuickAction(data);
        if (status === 200) {
            toast({
                title: "Success",
                description: "Quick action has been updated successfully.",
                
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
