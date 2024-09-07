import {
    Box,
    Button,
    ButtonGroup,
    Card,
    CardBody,
    CardFooter,
    Divider,
    Heading,
    Stack,
    Text,
    useToast,
} from "@chakra-ui/react";
import { useConfirm } from "chakra-ui-confirm";
import { useState } from "react";

import { QuickAction } from "@/logic/interfaces.ts";
import { deleteQuickAction } from "@/logic/quickActions.ts";
import EditQuickActionModal from "@/Pages/Settings/Components/EditQuickActionModal.tsx";

interface QuickActionCardProps {
    quickAction: QuickAction;
    fetchData: () => void;
}

const QuickActionCard = ({ quickAction, fetchData }: QuickActionCardProps) => {
    const confirm = useConfirm();
    const toast = useToast();
    const [isOpenEditQuickActionModal, setIsOpenEditQuickActionModal] =
        useState(false);

    const handleDelete = async () => {
        confirm({
            title: "Delete quick action",
            description:
                "Are you sure you want to delete this quick action? This action cannot be undone",
        })
            .then(async () => {
                const status = await deleteQuickAction(quickAction.id);
                if (status === 204) {
                    toast({
                        title: "Successfully deleted quick action.",
                        status: "success",
                    });
                    fetchData();
                } else {
                    toast({
                        title: "Error",
                        description: "Something went wrong",
                        status: "error",
                    });
                }
            })
            .catch(() => {
                toast({
                    title: "Cancelled",
                    description:
                        "You have cancelled the deletion of the quick action.",
                    status: "info",
                });
            });
    };

    const handleCloseEditModal = () => {
        setIsOpenEditQuickActionModal(false);
        fetchData();
    };
    return (
        <>
            <Card backgroundColor="gray.400">
                <CardBody>
                    <Box
                        display="flex"
                        gap={2}
                        alignItems="center"
                        justifyContent="space-between"
                    >
                        <Heading size="md">{quickAction.name}</Heading>
                    </Box>
                    <Stack mt="3" spacing="1">
                        <Text>
                            Comment:{" "}
                            {quickAction.comment ? quickAction.comment : "None"}
                        </Text>
                        <Text>
                            Give extra attempt:{" "}
                            {quickAction.giveExtra ? "Yes" : "No"}
                        </Text>
                        <Text>
                            Shared with other delegates:{" "}
                            {quickAction.isShared ? "Yes" : "No"}
                        </Text>
                        <Text>Created by: {quickAction.user.fullName}</Text>
                    </Stack>
                </CardBody>
                <Divider />
                <CardFooter>
                    <ButtonGroup spacing="2">
                        <Button
                            variant="solid"
                            colorScheme="blue"
                            onClick={() => setIsOpenEditQuickActionModal(true)}
                        >
                            Edit
                        </Button>
                        <Button
                            variant="solid"
                            colorScheme="red"
                            onClick={handleDelete}
                        >
                            Delete
                        </Button>
                    </ButtonGroup>
                </CardFooter>
            </Card>
            <EditQuickActionModal
                isOpen={isOpenEditQuickActionModal}
                onClose={handleCloseEditModal}
                quickAction={quickAction}
            />
        </>
    );
};

export default QuickActionCard;
