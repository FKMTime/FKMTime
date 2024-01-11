import { Box, Button, FormControl, FormLabel, Input, Select, useToast } from "@chakra-ui/react";
import { Modal } from "./Modal";
import { createAccount } from "../../logic/accounts";
import { useState } from "react";

interface CreateAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CreateAccountModal: React.FC<CreateAccountModalProps> = ({ isOpen, onClose }): JSX.Element => {

    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        setIsLoading(true);
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const username = data.get("username") as string;
        const email = data.get("email") as string;
        const role = data.get("role") as string;

        const response = await createAccount(email, username, role);
        if (response.status === 201) {
            toast({
                title: "Successfully created account.",
                description: "Password has been sent to the user's email.",
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
        <Modal isOpen={isOpen} onClose={onClose} title="Create Account">
            <Box display="flex" flexDirection="column" gap="5" as="form" onSubmit={handleSubmit}>
                <FormControl isRequired>
                    <FormLabel>Username</FormLabel>
                    <Input placeholder='Username' _placeholder={{ color: "white" }} name="username" disabled={isLoading} />
                </FormControl>
                <FormControl isRequired>
                    <FormLabel>Email</FormLabel>
                    <Input placeholder='Email' type="email" _placeholder={{ color: "white" }} name="email" disabled={isLoading} />
                </FormControl>
                <FormControl isRequired>
                    <FormLabel>Role</FormLabel>
                    <Select placeholder='Select role' _placeholder={{ color: "white" }} name="role" disabled={isLoading}>
                        <option value='DELEGATE'>Delegate</option>
                        <option value='ADMIN'>Admin</option>
                    </Select>
                </FormControl>
                <Box display="flex" flexDirection="row" justifyContent="end" gap="5">
                    {!isLoading && (
                        <Button colorScheme='red' onClick={onClose}>
                            Cancel
                        </Button>
                    )}
                    <Button colorScheme='green' type="submit" isLoading={isLoading}>Submit</Button>
                </Box>
            </Box>
        </Modal >
    )
};

export default CreateAccountModal;
