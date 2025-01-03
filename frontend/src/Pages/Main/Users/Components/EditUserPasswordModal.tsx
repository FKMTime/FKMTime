import {
    Box,
    Button,
    FormControl,
    FormLabel,
    useToast,
} from "@chakra-ui/react";
import { FormEvent, useState } from "react";

import { Modal } from "@/Components/Modal";
import PasswordInput from "@/Components/PasswordInput.tsx";
import { User } from "@/logic/interfaces";
import { updateUserPassword } from "@/logic/user";

interface EditUserPasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User;
}

const EditUserPasswordModal = ({
    isOpen,
    onClose,
    user,
}: EditUserPasswordModalProps) => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        setIsLoading(true);
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const password = data.get("password") as string;
        const status = await updateUserPassword(user.id, password);
        if (status === 200) {
            toast({
                title: "Successfully changed password.",
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
                    <PasswordInput
                        placeholder="New password"
                        isDisabled={isLoading}
                        name="password"
                        autoComplete="off"
                    />
                </FormControl>
                <Box
                    display="flex"
                    flexDirection="row"
                    justifyContent="end"
                    gap="5"
                >
                    {!isLoading && (
                        <Button colorPalette="red" onClick={onClose}>
                            Cancel
                        </Button>
                    )}
                    <Button
                        colorPalette="green"
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

export default EditUserPasswordModal;
