import { Box, Flex, Text, useToast } from "@chakra-ui/react";
import { useState } from "react";
import { MdDelete, MdEdit } from "react-icons/md";

import Alert from "@/Components/Alert.tsx";
import RoundedIconButton from "@/Components/RoundedIconButton.tsx";
import { QuickAction } from "@/logic/interfaces.ts";
import { deleteQuickAction } from "@/logic/quickActions.ts";
import EditQuickActionModal from "@/Pages/Settings/Components/EditQuickActionModal.tsx";

interface QuickActionCardProps {
    quickAction: QuickAction;
    fetchData: () => void;
}

const QuickActionCard = ({ quickAction, fetchData }: QuickActionCardProps) => {
    const toast = useToast();
    const [openConfirmation, setOpenConfirmation] = useState(false);
    const [isOpenEditQuickActionModal, setIsOpenEditQuickActionModal] =
        useState(false);

    const handleConfirm = async () => {
        setOpenConfirmation(false);
        const status = await deleteQuickAction(quickAction.id);
        if (status === 204) {
            toast({
                title: "Successfully deleted quick action.",
                status: "success",
                duration: 9000,
                isClosable: true,
            });
            fetchData();
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                status: "error",
                duration: 9000,
                isClosable: true,
            });
        }
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
                    onClick={() => setOpenConfirmation(true)}
                />
            </Flex>
            <Alert
                isOpen={openConfirmation}
                onCancel={() => setOpenConfirmation(false)}
                onConfirm={handleConfirm}
                title="Delete quick action"
                description="Are you sure you want to delete this quick action? This action cannot be undone"
            />
            <EditQuickActionModal
                isOpen={isOpenEditQuickActionModal}
                onClose={handleCloseEditModal}
                quickAction={quickAction}
            />
        </Box>
    );
};

export default QuickActionCard;
