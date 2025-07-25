import { Check } from "lucide-react";
import { useState } from "react";

import { Modal } from "@/Components/Modal";
import PersonAutocomplete from "@/Components/PersonAutocomplete";
import { Button } from "@/Components/ui/button";
import { useToast } from "@/hooks/useToast";
import { addUnassignedPerson } from "@/lib/attendance";
import { Person } from "@/lib/interfaces";

interface AddNotAssignedPersonModalProps {
    isOpen: boolean;
    onClose: () => void;
    groupId: string;
    role: string;
}

const AddNotAssignedPersonModal = ({
    isOpen,
    onClose,
    groupId,
    role,
}: AddNotAssignedPersonModalProps) => {
    const { toast } = useToast();
    const [person, setPerson] = useState<Person | null>(null);

    const handleAddPerson = async () => {
        if (!person || !groupId || !role) {
            toast({
                title: "Error",
                description:
                    "Please select a person and ensure group and role are set",
                variant: "destructive",
            });
            return;
        }

        const status = await addUnassignedPerson(groupId, person.id, role);
        if (status === 201) {
            toast({
                title: "Success",
                description: "Person added and marked as present",
                variant: "success",
            });
        } else if (status === 404) {
            toast({
                title: "Error",
                description: "Group or person not found",
                variant: "destructive",
            });
        } else if (status === 409) {
            toast({
                title: "Error",
                description:
                    "Person is already marked as present in another role during this group",
                variant: "destructive",
            });
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
        }
        onClose();
    };
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={"Add unassigned person"}
        >
            <PersonAutocomplete
                onSelect={(p) => setPerson(p)}
                defaultValue={person?.id}
            />
            <Button
                variant="success"
                onClick={handleAddPerson}
                disabled={!person}
            >
                <Check />
                Add and mark as present
            </Button>
        </Modal>
    );
};

export default AddNotAssignedPersonModal;
