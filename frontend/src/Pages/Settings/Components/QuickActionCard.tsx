import { Box, Flex, Text, useToast } from "@chakra-ui/react";
import { useConfirm } from "chakra-ui-confirm";
import { useState } from "react";
import { MdDelete, MdEdit } from "react-icons/md";

import RoundedIconButton from "@/Components/RoundedIconButton.tsx";
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
        <Box
            key={quickAction.id}
            bg="gray.900"
            p="5"
            rounded="md"
            color="white"
            display="flex"
            flexDirection="column"
            gap="3"
            alignItems="center"
            justifyContent="center"
        >
            <Text>Name: {quickAction.name}</Text>
            <Text>
                Comment: {quickAction.comment ? quickAction.comment : "None"}
            </Text>
            <Text>
                Give extra attempt: {quickAction.giveExtra ? "Yes" : "No"}
            </Text>
            <Flex gap="3">
                <RoundedIconButton
                    icon={<MdEdit />}
                    title="Edit quick action"
                    ariaLabel="Edit"
                    onClick={() => setIsOpenEditQuickActionModal(true)}
                />
                <RoundedIconButton
                    icon={<MdDelete />}
                    title="Delete quick action"
                    ariaLabel="Delete"
                    onClick={handleDelete}
                />
            </Flex>
            <EditQuickActionModal
                isOpen={isOpenEditQuickActionModal}
                onClose={handleCloseEditModal}
                quickAction={quickAction}
            />
        </Box>
    );
};

export default QuickActionCard;
