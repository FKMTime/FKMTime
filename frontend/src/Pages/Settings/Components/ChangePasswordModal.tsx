import {
    Box,
    Button,
    FormControl,
    FormLabel,
    Input,
    useToast,
} from "@chakra-ui/react";
import { FormEvent, RefObject, useRef, useState } from "react";

import { Modal } from "@/Components/Modal";
import { changePassword } from "@/logic/settings";

interface ChangePasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ChangePasswordModal = ({ isOpen, onClose }: ChangePasswordModalProps) => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const currentPasswordRef: RefObject<HTMLInputElement> =
        useRef<HTMLInputElement>(null);
    const newPasswordRef: RefObject<HTMLInputElement> =
        useRef<HTMLInputElement>(null);
    const repeatNewPasswordRef: RefObject<HTMLInputElement> =
        useRef<HTMLInputElement>(null);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        setIsLoading(true);
        event.preventDefault();
        if (
            !currentPasswordRef.current ||
            !newPasswordRef.current ||
            !repeatNewPasswordRef.current
        )
            return;
        if (
            newPasswordRef.current.value !== repeatNewPasswordRef.current.value
        ) {
            toast({
                title: "Error",
                description: "Passwords do not match",
                status: "error",
                duration: 9000,
                isClosable: true,
            });
            setIsLoading(false);
            return;
        }

        const status = await changePassword(
            currentPasswordRef.current.value,
            newPasswordRef.current.value
        );
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
                    <FormLabel>Current password</FormLabel>
                    <Input
                        placeholder="Current password"
                        type="password"
                        _placeholder={{ color: "white" }}
                        disabled={isLoading}
                        ref={currentPasswordRef}
                    />
                </FormControl>
                <FormControl isRequired>
                    <FormLabel>New password</FormLabel>
                    <Input
                        placeholder="New password"
                        type="password"
                        _placeholder={{ color: "white" }}
                        disabled={isLoading}
                        ref={newPasswordRef}
                    />
                </FormControl>
                <FormControl isRequired>
                    <FormLabel>Repeat new password</FormLabel>
                    <Input
                        placeholder="Repeat new password"
                        type="password"
                        _placeholder={{ color: "white" }}
                        disabled={isLoading}
                        ref={repeatNewPasswordRef}
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

export default ChangePasswordModal;
