import { Check, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { Modal } from "@/Components/Modal";
import PersonAutocomplete from "@/Components/PersonAutocomplete";
import { Alert, AlertDescription } from "@/Components/ui/alert";
import { Button } from "@/Components/ui/button";
import { useDialogError } from "@/hooks/useDialogError";
import { prettyActivityName } from "@/lib/activities";
import { addUnassignedPerson } from "@/lib/attendance";
import { Person, StaffActivity } from "@/lib/interfaces";

interface AddNotAssignedPersonModalProps {
    isOpen: boolean;
    onClose: () => void;
    groupId: string;
    role: string;
    /** Everyone in this group, in every role */
    groupAttendance: StaffActivity[];
}

const AddNotAssignedPersonModal = ({
    isOpen,
    onClose,
    groupId,
    role,
    groupAttendance,
}: AddNotAssignedPersonModalProps) => {
    const [error, setError] = useDialogError(isOpen);
    const [person, setPerson] = useState<Person | null>(null);
    const roleName = prettyActivityName(role).toLowerCase();
    const competesInGroup =
        !!person &&
        role !== "COMPETITOR" &&
        groupAttendance.some(
            (activity) =>
                activity.role === "COMPETITOR" &&
                activity.person.id === person.id
        );

    const handleAddPerson = async () => {
        if (!person || !groupId || !role) {
            setError("Choose a person to add.");
            return;
        }

        const { status, message } = await addUnassignedPerson(
            groupId,
            person.id,
            role
        );
        if (status === 404) {
            setError("Group or person not found");
        } else if (status === 409) {
            // Says whether they are already present, late or replaced
            setError(
                message ??
                    `${person.name} is already marked in this group as a ${roleName}`
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
            {competesInGroup && (
                <Alert variant="warning">
                    <TriangleAlert aria-hidden />
                    <AlertDescription>
                        {person.name} is competing in this group. Add them as{" "}
                        {roleName} anyway?
                    </AlertDescription>
                </Alert>
            )}
            <Button onClick={handleAddPerson} disabled={!person}>
                <Check />
                {competesInGroup ? "Add anyway" : "Add and mark as present"}
            </Button>
        </Modal>
    );
};

export default AddNotAssignedPersonModal;
