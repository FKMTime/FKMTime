import { Check } from "lucide-react";
import { useState } from "react";

import { Modal } from "@/Components/Modal";
import PersonAutocomplete from "@/Components/PersonAutocomplete";
import { Button } from "@/Components/ui/button";
import { useDialogError } from "@/hooks/useDialogError";
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
    const [error, setError] = useDialogError(isOpen);
    const [person, setPerson] = useState<Person | null>(null);

    const handleAddPerson = async () => {
        if (!person || !groupId || !role) {
            setError("Choose a person to add.");
            return;
        }

        const status = await addUnassignedPerson(groupId, person.id, role);
        if (status === 404) {
            setError("Group or person not found");
        } else if (status === 409) {
            setError(
                "Person is already marked as present in another role during this group"
            );
        } else if (status !== 201) {
            setError("Something went wrong");
        } else {
            onClose();
        }
    };
    return (
        <Modal
            error={error}
            isOpen={isOpen}
            onClose={onClose}
            title={"Add unassigned person"}
        >
            <PersonAutocomplete
                onSelect={(p) => setPerson(p)}
                defaultValue={person?.id}
            />
            <Button onClick={handleAddPerson} disabled={!person}>
                <Check />
                Add and mark as present
            </Button>
        </Modal>
    );
};

export default AddNotAssignedPersonModal;
