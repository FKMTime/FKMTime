import {
    Box,
    Button,
    FormControl,
    FormLabel,
    useToast,
} from "@chakra-ui/react";
import { FormEvent, useState } from "react";

import { Modal } from "@/Components/Modal";
import Select from "@/Components/Select";
import { swapAttempts } from "@/logic/attempt";
import { Attempt } from "@/logic/interfaces";

interface SwapAttemptsModalProps {
    isOpen: boolean;
    onClose: () => void;
    attempts: Attempt[];
}

const SwapAttemptsModal = ({
    isOpen,
    onClose,
    attempts,
}: SwapAttemptsModalProps) => {
    const toast = useToast();
    const [firstAttemptId, setFirstAttemptId] = useState<string>("");
    const [secondAttemptId, setSecondAttemptId] = useState<string>("");

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
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
                    <Select
                        value={firstAttemptId}
                        onChange={(e) => setFirstAttemptId(e.target.value)}
                    >
                        {attempts.map((attempt) => (
                            <option key={attempt.id} value={attempt.id}>
                                Attempt {attempt.attemptNumber}
                            </option>
                        ))}
                    </Select>
                </FormControl>
                <FormControl>
                    <FormLabel>Second attempt</FormLabel>
                    <Select
                        value={secondAttemptId}
                        onChange={(e) => setSecondAttemptId(e.target.value)}
                    >
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
