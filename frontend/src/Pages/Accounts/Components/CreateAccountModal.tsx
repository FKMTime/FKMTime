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
import PasswordInput from "@/Components/PasswordInput.tsx";
import Select from "@/Components/Select";
import { createAccount } from "@/logic/accounts";
import { AccountRole } from "@/logic/interfaces.ts";
import { prettyAccountRoleName } from "@/logic/utils.ts";

interface CreateAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CreateAccountModal = ({ isOpen, onClose }: CreateAccountModalProps) => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [role, setRole] = useState<string>("");

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        setIsLoading(true);
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const username = data.get("username") as string;
        const password = data.get("password") as string;
        const fullName = data.get("fullName") as string;

        const response = await createAccount(
            username,
            role,
            password,
            fullName
        );
        if (response.status === 201) {
            toast({
                title: "Success",
                description: "Account has been created successfully.",
                status: "success",
            });
            onClose();
        } else if (response.status === 409) {
            toast({
                title: "Error",
                description: "Username already taken!",
                status: "error",
            });
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
        <Modal isOpen={isOpen} onClose={onClose} title="Create account">
            <Box
                display="flex"
                flexDirection="column"
                gap="5"
                as="form"
                onSubmit={handleSubmit}
            >
                <FormControl isRequired>
                    <FormLabel>Username</FormLabel>
                    <Input
                        placeholder="Username"
                        _placeholder={{ color: "white" }}
                        name="username"
                        disabled={isLoading}
                    />
                </FormControl>
                <FormControl>
                    <FormLabel>Full name</FormLabel>
                    <Input
                        placeholder="Full name"
                        _placeholder={{ color: "white" }}
                        name="fullName"
                        isDisabled={isLoading}
                    />
                </FormControl>
                <FormControl isRequired>
                    <FormLabel>Password</FormLabel>
                    <PasswordInput
                        placeholder="Password"
                        name="password"
                        isDisabled={isLoading}
                    />
                </FormControl>
                <FormControl isRequired>
                    <FormLabel>Role</FormLabel>
                    <Select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        disabled={isLoading}
                        placeholder="Select role"
                    >
                        {Object.keys(AccountRole).map((accountRole) => (
                            <option key={accountRole} value={accountRole}>
                                {prettyAccountRoleName(accountRole)}
                            </option>
                        ))}
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
                        Submit
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
};

export default CreateAccountModal;
