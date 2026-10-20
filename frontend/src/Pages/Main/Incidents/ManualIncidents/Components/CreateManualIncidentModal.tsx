import { useState } from "react";

import { Modal } from "@/Components/Modal";
import { useToast } from "@/hooks/useToast";
import { createManualIncident } from "@/lib/incidents";
import { ManualIncidentData } from "@/lib/interfaces";

import ManualIncidentForm from "./ManualIncidentForm";

interface CreateManualIncidentModalProps {
    isOpen: boolean;
    onClose: (created: boolean) => void;
}

const CreateManualIncidentModal = ({
    isOpen,
    onClose,
}: CreateManualIncidentModalProps) => {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (data: ManualIncidentData) => {
        setIsLoading(true);
        const status = await createManualIncident(data);
        setIsLoading(false);
        if (status === 201) {
            onClose(true);
        } else {
            toast({
                title: "Error",
                description: "Failed to add the incident.",
                variant: "destructive",
            });
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => onClose(false)}
            title="Add manual incident"
        >
            <ManualIncidentForm
                submitText="Add incident"
                handleSubmit={handleSubmit}
                isLoading={isLoading}
            />
        </Modal>
    );
};

export default CreateManualIncidentModal;
