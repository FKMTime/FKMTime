import { useToast } from "@chakra-ui/react";
import { useState } from "react";

import { Modal } from "@/Components/Modal";
import { getUserInfo } from "@/logic/auth";
import { QuickAction } from "@/logic/interfaces";
import { createQuickAction } from "@/logic/quickActions.ts";

import QuickActionForm from "./QuickActionForm";

interface CreateQuickActionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const defaultQuickAction = {
    id: "",
    name: "",
    comment: "",
    giveExtra: false,
    isShared: true,
    user: getUserInfo(),
};

const CreateQuickActionModal = ({
    isOpen,
    onClose,
}: CreateQuickActionModalProps) => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (data: QuickAction) => {
        setIsLoading(true);
        const status = await createQuickAction(data);
        if (status === 201) {
            toast({
                title: "Success",
                description: "Quick action has been created successfully.",
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
        <Modal isOpen={isOpen} onClose={onClose} title="Create quick action">
            <QuickActionForm
                quickAction={defaultQuickAction}
                handleSubmit={handleSubmit}
                handleCancel={onClose}
                isLoading={isLoading}
            />
        </Modal>
    );
};

export default CreateQuickActionModal;
