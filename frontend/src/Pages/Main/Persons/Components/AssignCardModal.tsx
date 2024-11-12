import {
    Box,
    Button,
    FormControl,
    FormLabel,
    Input,
    useToast,
} from "@chakra-ui/react";
import { FormEvent, useState } from "react";

import { Modal } from "@/Components/Modal";
import { isAdmin } from "@/logic/auth";
import { Person } from "@/logic/interfaces";
import { updatePerson } from "@/logic/persons";

interface AssignCardModalProps {
    isOpen: boolean;
    onClose: () => void;
    person: Person;
}

const AssignCardModal = ({ isOpen, onClose, person }: AssignCardModalProps) => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [editedPerson, setEditedPerson] = useState<Person>(person);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        setIsLoading(true);
        event.preventDefault();

        const status = await updatePerson(editedPerson);
        if (status === 200) {
            toast({
                title: "Successfully updated person.",
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
        <Modal isOpen={isOpen} onClose={onClose} title="Assign card">
            <Box
                display="flex"
                flexDirection="column"
                gap="5"
                as="form"
                onSubmit={handleSubmit}
            >
                <FormControl>
                    <FormLabel>Card</FormLabel>
                    <Input
                        placeholder="Card"
                        isReadOnly={!isAdmin()}
                        _placeholder={{ color: "white" }}
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
                </FormControl>
                <Box
                    display="flex"
                    flexDirection="row"
                    justifyContent="end"
                    gap="5"
                >
                    {!isLoading && (
                        <Button colorScheme="red" onClick={onClose}>
                            Cancel
                        </Button>
                    )}
                    {isAdmin() && (
                        <Button
                            colorScheme="green"
                            type="submit"
                            isLoading={isLoading}
                        >
                            Save
                        </Button>
                    )}
                </Box>
            </Box>
        </Modal>
    );
};

export default AssignCardModal;
