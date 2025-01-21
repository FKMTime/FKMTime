import { useState } from "react";

import { Modal } from "@/Components/Modal";
import { useToast } from "@/hooks/useToast";
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
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (data: QuickActionData) => {
        setIsLoading(true);
        const status = await createQuickAction(data);
        if (status === 201) {
            toast({
                title: "Success",
                description: "Quick action has been created successfully.",
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
        <Modal isOpen={isOpen} onClose={onClose} title="Create quick action">
            <QuickActionForm
                handleSubmit={handleSubmit}
                isLoading={isLoading}
            />
        </Modal>
    );
};

export default CreateQuickActionModal;
