import {
    Box,
    Button,
    FormControl,
    FormLabel,
    Input,
    Select,
    useToast,
} from "@chakra-ui/react";
import { Modal } from "./Modal";
import React, { useState } from "react";
import { addStaffMember } from "../../logic/persons";

interface AddStaffMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AddStaffMemberModal: React.FC<AddStaffMemberModalProps> = ({
    isOpen,
    onClose,
}): JSX.Element => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        setIsLoading(true);
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const name = data.get("name") as string;
        const gender = data.get("gender") as string;

        const status = await addStaffMember(name, gender);
        if (status === 201) {
            toast({
                title: "Successfully added staff member",
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
        <Modal isOpen={isOpen} onClose={onClose} title="Add staff member">
            <Box
                display="flex"
                flexDirection="column"
                gap="5"
                as="form"
                onSubmit={handleSubmit}
            >
                <FormControl>
                    <FormLabel>Name</FormLabel>
                    <Input
                        placeholder="Name"
                        disabled={isLoading}
                        name="name"
                    />
                </FormControl>
                <FormControl isRequired>
                    <FormLabel>Gender</FormLabel>
                    <Select
                        placeholder="Select gender"
                        _placeholder={{ color: "white" }}
                        name="gender"
                        disabled={isLoading}
                    >
                        <option value="m">Male</option>
                        <option value="f">Female</option>
                        <option value="o">Other</option>
                    </Select>
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
                    <Button
                        colorScheme="green"
                        type="submit"
                        isLoading={isLoading}
                    >
                        Save
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
};

export default AddStaffMemberModal;
