import { useState } from "react";

import { Modal } from "@/Components/Modal";
import { Alert } from "@/Components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/Components/ui/tabs";
import { useDialogError } from "@/hooks/useDialogError";
import { useToast } from "@/hooks/useToast";
import { AddPerson } from "@/lib/interfaces";
import { addPerson } from "@/lib/persons";

import PersonForm from "./PersonForm";

interface AddPersonModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AddPersonModal = ({ isOpen, onClose }: AddPersonModalProps) => {
    const [error, setError] = useDialogError(isOpen);
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (data: AddPerson) => {
        const status = await addPerson(data);
        if (status === 201) {
            toast({
                title: "Successfully added new person",
            });
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
            title="Add person"
        >
            <Tabs defaultValue="staff">
                <TabsList>
                    <TabsTrigger value="staff">Staff member</TabsTrigger>
                    <TabsTrigger value="competitor">Competitor</TabsTrigger>
                </TabsList>
                <TabsContent value="staff">
                    <PersonForm
                        isLoading={isLoading}
                        handleSubmit={handleSubmit}
                    />
                </TabsContent>
                <TabsContent value="competitor">
                    <Alert>
                        Use this form only if the competitor compete only in
                        unofficial events. If you want to add a competitor who
                        registered on the spot please do it on the WCA Website
                        and sync.
                    </Alert>
                    <PersonForm
                        canCompete
                        isLoading={isLoading}
                        handleSubmit={handleSubmit}
                    />
                </TabsContent>
            </Tabs>
        </Modal>
    );
};

export default AddPersonModal;
