import { useState } from "react";

import { Modal } from "@/Components/Modal";
import { useToast } from "@/hooks/useToast";
import { updateManualIncident } from "@/lib/incidents";
import { ManualIncident, ManualIncidentData } from "@/lib/interfaces";

import ManualIncidentForm from "./ManualIncidentForm";

interface EditManualIncidentModalProps {
    incident: ManualIncident;
    isOpen: boolean;
    onClose: () => void;
}

const EditManualIncidentModal = ({
    isOpen,
    onClose,
    incident,
}: EditManualIncidentModalProps) => {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (data: ManualIncidentData) => {
        setIsLoading(true);
        const status = await updateManualIncident(incident.id, data);
        if (status === 200) {
            toast({
                title: "Successfully updated incident.",
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
        <Modal isOpen={isOpen} onClose={onClose} title="Edit incident">
            <ManualIncidentForm
                isLoading={isLoading}
                handleSubmit={handleSubmit}
                defaultValues={incident}
                submitText="Edit"
            />
        </Modal>
    );
};

export default EditManualIncidentModal;
