import { Box, Button, FormControl, FormLabel, Input, useToast } from "@chakra-ui/react";
import { Modal } from "./Modal";
import { useState } from "react";
import { Person } from "../../logic/interfaces";
import { updatePerson } from "../../logic/persons";
import {getUserInfo} from "../../logic/auth.ts";
import {HAS_WRITE_ACCESS} from "../../logic/accounts.ts";

interface AssignCardModalProps {
    isOpen: boolean;
    onClose: () => void;
    person: Person;
}

const AssignCardModal: React.FC<AssignCardModalProps> = ({ isOpen, onClose, person }): JSX.Element => {

    const toast = useToast();
    const userInfo = getUserInfo();
    const [isLoading, setIsLoading] = useState(false);
    const [editedPerson, setEditedPerson] = useState<Person>(person);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        setIsLoading(true);
        event.preventDefault();
    
        const status = await updatePerson(editedPerson);
        if (status === 200) {
            toast({
                title: "Successfully updated person.",
                status: "success",
                duration: 9000,
                isClosable: true,
            });
            onClose();
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                status: "error",
                duration: 9000,
                isClosable: true,
            });
        }
        setIsLoading(false);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Assign card">
            <Box display="flex" flexDirection="column" gap="5" as="form" onSubmit={handleSubmit}>
                <FormControl>
                    <FormLabel>Card</FormLabel>
                    <Input placeholder='Card' isReadOnly={!HAS_WRITE_ACCESS.includes(userInfo.role)} _placeholder={{ color: "white" }} value={editedPerson.cardId} disabled={isLoading} onChange={(e) => setEditedPerson({ ...editedPerson, cardId: e.target.value })} autoFocus />
                </FormControl>
                <Box display="flex" flexDirection="row" justifyContent="end" gap="5">
                    {!isLoading && (
                        <Button colorScheme='red' onClick={onClose}>
                            Cancel
                        </Button>
                    )}
                    {HAS_WRITE_ACCESS.includes(userInfo.role) && (
                        <Button colorScheme='green' type="submit" isLoading={isLoading}>
                            Save
                        </Button>
                    )}
                </Box>
            </Box>
        </Modal >
    )
};

export default AssignCardModal;
