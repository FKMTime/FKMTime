import { useState } from "react";

import { Modal } from "@/Components/Modal";
import { useToast } from "@/hooks/useToast";
import { updateNoteworthyIncident } from "@/lib/incidents";
import { NoteworthyIncident, NoteworthyIncidentData } from "@/lib/interfaces";

import NoteworthyIncidentForm from "./NoteworthyIncidentForm";

interface EditNoteworthyIncidentModalProps {
    incident: NoteworthyIncident;
    isOpen: boolean;
    onClose: () => void;
}

const EditNoteworthyIncidentModal = ({
    isOpen,
    onClose,
    incident,
}: EditNoteworthyIncidentModalProps) => {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (data: NoteworthyIncidentData) => {
        setIsLoading(true);
        const status = await updateNoteworthyIncident(incident.id, data);
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
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Edit noteworthy incident"
        >
            <NoteworthyIncidentForm
                isLoading={isLoading}
                handleSubmit={handleSubmit}
                defaultValues={incident}
                submitText="Edit"
            />
        </Modal>
    );
};

export default EditNoteworthyIncidentModal;
