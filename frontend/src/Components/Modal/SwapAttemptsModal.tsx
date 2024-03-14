import { Attempt } from "../../logic/interfaces.ts";
import { Modal } from "./Modal.tsx";
import {
    Box,
    Button,
    FormControl,
    FormLabel,
    Select,
    useToast,
} from "@chakra-ui/react";
import { swapAttempts } from "../../logic/attempt.ts";

interface SwapAttemptsModalProps {
    isOpen: boolean;
    onClose: () => void;
    attempts: Attempt[];
}

const SwapAttemptsModal: React.FC<SwapAttemptsModalProps> = ({
    isOpen,
    onClose,
    attempts,
}) => {
    const toast = useToast();
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const firstAttemptId = data.get("firstAttempt") as string;
        const secondAttemptId = data.get("secondAttempt") as string;
        if (firstAttemptId === secondAttemptId) {
            return toast({
                title: "Error",
                description: "You can't swap an attempt with itself",
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        }
        const status = await swapAttempts(firstAttemptId, secondAttemptId);
        if (status === 200) {
            toast({
                title: "Success",
                description: "Attempts swapped successfully",
                status: "success",
                duration: 5000,
                isClosable: true,
            });
            onClose();
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Swap two attempts">
            <Box
                display="flex"
                flexDirection="column"
                gap="5"
                as="form"
                onSubmit={handleSubmit}
            >
                <FormControl>
                    <FormLabel>First attempt</FormLabel>
                    <Select name="firstAttempt">
                        {attempts.map((attempt) => (
                            <option key={attempt.id} value={attempt.id}>
                                Attempt {attempt.attemptNumber}
                            </option>
                        ))}
                    </Select>
                </FormControl>
                <FormControl>
                    <FormLabel>Second attempt</FormLabel>
                    <Select name="secondAttempt">
                        {attempts.map((attempt) => (
                            <option key={attempt.id} value={attempt.id}>
                                Attempt {attempt.attemptNumber}
                            </option>
                        ))}
                    </Select>
                </FormControl>
                <Button colorScheme="green" type="submit">
                    Swap attempts
                </Button>
            </Box>
        </Modal>
    );
};

export default SwapAttemptsModal;
