import {
    Box,
    Button,
    FormControl,
    FormLabel,
    Input,
    useToast,
} from "@chakra-ui/react";
import { FormEvent, useState } from "react";

import { Modal } from "@/Components/Modal.tsx";
import { updateAttempt } from "@/logic/attempt.ts";
import { Attempt, AttemptStatus } from "@/logic/interfaces.ts";

interface GiveExtraAttemptModalProps {
    isOpen: boolean;
    onClose: () => void;
    attempt: Attempt;
}

const GiveExtraAttemptModal = ({
    isOpen,
    onClose,
    attempt,
}: GiveExtraAttemptModalProps) => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [editedAttempt, setEditedAttempt] = useState<Attempt>(attempt);
    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsLoading(true);
        const status = await updateAttempt({
            ...editedAttempt,
            status: AttemptStatus.EXTRA_GIVEN,
        });
        if (status === 200) {
            toast({
                title: "Successfully given extra.",
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
        <Modal isOpen={isOpen} onClose={onClose} title="Give extra attempt">
            <Box
                display="flex"
                flexDirection="column"
                gap="5"
                as="form"
                onSubmit={handleSubmit}
            >
                <FormControl>
                    <FormLabel>Comment</FormLabel>
                    <Input
                        placeholder="Comment"
                        _placeholder={{ color: "white" }}
                        value={editedAttempt.comment}
                        disabled={isLoading}
                        onChange={(e) =>
                            setEditedAttempt({
                                ...editedAttempt,
                                comment: e.target.value,
                            })
                        }
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

export default GiveExtraAttemptModal;
