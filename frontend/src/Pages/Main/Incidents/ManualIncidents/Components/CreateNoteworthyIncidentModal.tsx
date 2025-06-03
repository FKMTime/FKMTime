import { useState } from "react";

import { Modal } from "@/Components/Modal";
import { useToast } from "@/hooks/useToast";
import { createNoteworthyIncident } from "@/lib/incidents";
import { NoteworthyIncidentData } from "@/lib/interfaces";

import NoteworthyIncidentForm from "./NoteworthyIncidentForm";

interface CreateNoteworthyIncidentModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CreateNoteworthyIncidentModal = ({
    isOpen,
    onClose,
}: CreateNoteworthyIncidentModalProps) => {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (data: NoteworthyIncidentData) => {
        setIsLoading(true);
        const status = await createNoteworthyIncident(data);
        if (status === 201) {
            toast({
                title: "Successfully created new incident.",
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

    const defaultValues: NoteworthyIncidentData = {
        title: "",
        description: "",
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Add noteworthy incident"
        >
            <NoteworthyIncidentForm
                isLoading={isLoading}
                handleSubmit={handleSubmit}
                defaultValues={defaultValues}
                submitText="Add"
            />
        </Modal>
    );
};

export default CreateNoteworthyIncidentModal;
