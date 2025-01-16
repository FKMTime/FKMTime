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

import { QuickAction } from "@/lib/interfaces";
import { deleteQuickAction } from "@/lib/quickActions";
import EditQuickActionModal from "@/Pages/Main/Settings/Components/EditQuickActionModal";

interface QuickActionCardProps {
    quickAction: QuickAction;
    fetchData: () => void;
}

const QuickActionCard = ({ quickAction, fetchData }: QuickActionCardProps) => {
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
