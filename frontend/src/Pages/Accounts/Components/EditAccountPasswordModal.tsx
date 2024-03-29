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
import { updateAccountPassword } from "@/logic/accounts";
import { Account } from "@/logic/interfaces";

interface EditAccountPasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
    account: Account;
}

const EditAccountPasswordModal = ({
    isOpen,
    onClose,
    account,
}: EditAccountPasswordModalProps) => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        setIsLoading(true);
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const password = data.get("password") as string;
        const status = await updateAccountPassword(account.id, password);
        if (status === 200) {
            toast({
                title: "Successfully changed password.",
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
        <Modal isOpen={isOpen} onClose={onClose} title="Change password">
            <Box
                display="flex"
                flexDirection="column"
                gap="5"
                as="form"
                onSubmit={handleSubmit}
            >
                <FormControl isRequired>
                    <FormLabel>New password</FormLabel>
                    <Input
                        placeholder="New password"
                        _placeholder={{ color: "white" }}
                        disabled={isLoading}
                        type="password"
                        name="password"
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

export default EditAccountPasswordModal;
