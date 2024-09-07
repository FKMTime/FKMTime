import {
    Box,
    Button,
    Checkbox,
    FormControl,
    FormLabel,
    Input,
    Text,
} from "@chakra-ui/react";
import { useState } from "react";

import { QuickAction } from "@/logic/interfaces";

interface QuickActionFormProps {
    quickAction: QuickAction;
    handleSubmit: (data: QuickAction) => void;
    handleCancel: () => void;
    isLoading: boolean;
}

const QuickActionForm = ({
    quickAction,
    handleSubmit,
    handleCancel,
    isLoading,
}: QuickActionFormProps) => {
    const [editedQuickAction, setEditedQuickAction] =
        useState<QuickAction>(quickAction);

    const onSubmit = () => {
        handleSubmit(editedQuickAction);
    };
    return (
        <Box display="flex" flexDirection="column" gap="5" as="form">
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
            <Checkbox
                isChecked={editedQuickAction.isShared}
                onChange={(e) =>
                    setEditedQuickAction({
                        ...editedQuickAction,
                        isShared: e.target.checked,
                    })
                }
            >
                Share with other delegates
            </Checkbox>
            <Text>Created by: {quickAction.user.fullName}</Text>
            <Box
                display="flex"
                flexDirection="row"
                justifyContent="end"
                gap="5"
            >
                {!isLoading && (
                    <Button colorScheme="red" onClick={handleCancel}>
                        Cancel
                    </Button>
                )}
                <Button
                    colorScheme="green"
                    isLoading={isLoading}
                    onClick={onSubmit}
                >
                    Submit
                </Button>
            </Box>
        </Box>
    );
};

export default QuickActionForm;
