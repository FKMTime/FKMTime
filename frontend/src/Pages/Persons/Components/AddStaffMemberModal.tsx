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
import Select from "@/Components/Select";
import { addStaffMember } from "@/logic/persons";

interface AddStaffMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AddStaffMemberModal = ({ isOpen, onClose }: AddStaffMemberModalProps) => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [gender, setGender] = useState<string>("m");

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        setIsLoading(true);
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const name = data.get("name") as string;

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
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
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
