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
import { QuickAction } from "@/logic/interfaces.ts";
import { updateQuickAction } from "@/logic/quickActions.ts";

interface EditQuickActionModalProps {
    isOpen: boolean;
    onClose: () => void;
    quickAction: QuickAction;
}

const EditQuickActionModal = ({
    isOpen,
    onClose,
    quickAction,
}: EditQuickActionModalProps) => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [editedQuickAction, setEditedQuickAction] =
        useState<QuickAction>(quickAction);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsLoading(true);
        const status = await updateQuickAction(editedQuickAction);
        if (status === 200) {
            toast({
                title: "Success",
                description: "Quick action has been updated successfully.",
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
        <Modal isOpen={isOpen} onClose={onClose} title="Update quick action">
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
                        disabled={isLoading}
                        value={editedQuickAction.name}
                        onChange={(e) =>
                            setEditedQuickAction({
                                ...editedQuickAction,
                                name: e.target.value,
                            })
                        }
                    />
                </FormControl>
                <FormControl>
                    <FormLabel>Comment</FormLabel>
                    <Input
                        placeholder="Comment"
                        _placeholder={{ color: "white" }}
                        disabled={isLoading}
                        value={editedQuickAction.comment}
                        onChange={(e) =>
                            setEditedQuickAction({
                                ...editedQuickAction,
                                comment: e.target.value,
                            })
                        }
                    />
                </FormControl>
                <Checkbox
                    isChecked={editedQuickAction.giveExtra}
                    onChange={(e) =>
                        setEditedQuickAction({
                            ...editedQuickAction,
                            giveExtra: e.target.checked,
                        })
                    }
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

export default EditQuickActionModal;
