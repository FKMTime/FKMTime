import {
    Box,
    Button,
    Checkbox,
    FormControl,
    FormLabel,
    Input,
    useToast,
} from "@chakra-ui/react";
import { FormEvent, useState } from "react";

import { Modal } from "@/Components/Modal";
import { createQuickAction } from "@/logic/quickActions.ts";

interface CreateQuickActionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CreateQuickActionModal = ({
    isOpen,
    onClose,
}: CreateQuickActionModalProps) => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [giveExtra, setGiveExtra] = useState<boolean>(false);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsLoading(true);
        const data = new FormData(event.currentTarget);
        const name = data.get("name") as string;
        const comment = data.get("comment") as string;
        const status = await createQuickAction(name, comment, giveExtra);
        if (status === 201) {
            toast({
                title: "Success",
                description: "Quick action has been created successfully.",
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
        <Modal isOpen={isOpen} onClose={onClose} title="Create quick action">
            <Box
                display="flex"
                flexDirection="column"
                gap="5"
                as="form"
                onSubmit={handleSubmit}
            >
                <FormControl isRequired>
                    <FormLabel>Name</FormLabel>
                    <Input
                        placeholder="Name"
                        _placeholder={{ color: "white" }}
                        name="name"
                        disabled={isLoading}
                    />
                </FormControl>
                <FormControl>
                    <FormLabel>Comment</FormLabel>
                    <Input
                        placeholder="Comment"
                        _placeholder={{ color: "white" }}
                        name="comment"
                        disabled={isLoading}
                    />
                </FormControl>
                <Checkbox
                    isChecked={giveExtra}
                    onChange={(e) => setGiveExtra(e.target.checked)}
                >
                    Give extra attempt
                </Checkbox>
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

export default CreateQuickActionModal;
