import { useState } from "react";
import { Label } from "recharts";

import { Modal } from "@/Components/Modal";
import ModalActions from "@/Components/ModalActions";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { useToast } from "@/hooks/useToast";
import { Person } from "@/lib/interfaces";
import { isOrganizerOrDelegate } from "@/lib/permissions";
import { updatePerson } from "@/lib/persons";

interface AssignCardModalProps {
    isOpen: boolean;
    onClose: () => void;
    person: Person;
}

const AssignCardModal = ({ isOpen, onClose, person }: AssignCardModalProps) => {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [editedPerson, setEditedPerson] = useState<Person>(person);

    const handleSubmit = async () => {
        setIsLoading(true);

        const status = await updatePerson(editedPerson);
        if (status === 200) {
            toast({
                title: "Successfully updated person.",
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
        <Modal isOpen={isOpen} onClose={onClose} title="Assign card">
            <div className="felx flex-col gap-5">
                <div className="flex flex-col gap-2 mb-3">
                    <Label>Card</Label>
                    <Input
                        placeholder="Card"
                        readOnly={!isOrganizerOrDelegate()}
                        value={editedPerson.cardId}
                        disabled={isLoading}
                        onChange={(e) =>
                            setEditedPerson({
                                ...editedPerson,
                                cardId: e.target.value,
                            })
                        }
                        autoFocus
                    />
                </div>
                <ModalActions>
                    {isOrganizerOrDelegate() && (
                        <Button
                            variant="success"
                            type="submit"
                            className=""
                            onClick={handleSubmit}
                            disabled={isLoading}
                        >
                            Save
                        </Button>
                    )}
                </ModalActions>
            </div>
        </Modal>
    );
};

export default AssignCardModal;
