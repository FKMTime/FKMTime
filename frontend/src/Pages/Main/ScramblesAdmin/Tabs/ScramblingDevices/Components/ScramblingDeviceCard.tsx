import {
    Box,
    Button,
    Card,
    CardBody,
    CardFooter,
    Divider,
    GridItem,
    Heading,
    SimpleGrid,
    Stack,
    Text,
    useToast,
} from "@chakra-ui/react";
import { useConfirm } from "chakra-ui-confirm";
import { useState } from "react";

import { ScramblingDevice } from "@/lib/interfaces";
import { deleteScramblingDevice } from "@/lib/scramblingDevices";

import EditScramblingDeviceModal from "./EditScramblingDeviceModal";
import OneTimeCodeModal from "./OneTimeCodeModal";

interface ScramblingDeviceCardProps {
    device: ScramblingDevice;
    fetchData: () => void;
}

const ScramblingDeviceCard = ({
    device,
    fetchData,
}: ScramblingDeviceCardProps) => {
    const toast = useToast();
    const confirm = useConfirm();
    const [isOpenEditDeviceModal, setIsOpenEditDeviceModal] =
        useState<boolean>(false);
    const [isOpenOneTimeCodeModal, setIsOpenOneTimeCodeModal] =
        useState<boolean>(false);

    const handleCloseEditDeviceModal = async () => {
        fetchData();
        setIsOpenEditDeviceModal(false);
    };

    const handleDelete = async () => {
        confirm({
            title: "Delete scrambling device",
            description:
                "Are you sure you want to delete this device? This action cannot be undone",
        })
            .then(async () => {
                const status = await deleteScramblingDevice(device.id);
                if (status === 204) {
                    toast({
                        title: "Successfully deleted device.",
                        
                    });
                    fetchData();
                } else {
                    toast({
                        title: "Error",
                        description: "Something went wrong",
                        variant: "destructive",
                    });
                }
            })
            .catch(() => {
                toast({
                    title: "Cancelled",
                    description:
                        "You have cancelled the deletion of the device.",
                    status: "info",
                });
            });
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
                        <Heading size="md">Name: {device.name}</Heading>
                    </Box>
                    <Stack mt="3" spacing="1">
                        <Text>Room: {device.room.name}</Text>
                        <Text>
                            Updated at:{" "}
                            {new Date(device.updatedAt).toLocaleString()}
                        </Text>
                    </Stack>
                </CardBody>
                <Divider />
                <CardFooter>
                    <SimpleGrid gap={3} columns={2} width="100%">
                        <GridItem>
                            <Button
                                variant="solid"
                                colorScheme="blue"
                                onClick={() => setIsOpenEditDeviceModal(true)}
                                width="100%"
                            >
                                Edit
                            </Button>
                        </GridItem>
                        <GridItem>
                            <Button
                                variant="solid"
                                colorScheme="red"
                                onClick={handleDelete}
                                width="100%"
                            >
                                Delete
                            </Button>
                        </GridItem>
                        <GridItem colSpan={2}>
                            <Button
                                variant="solid"
                                colorScheme="yellow"
                                onClick={() => setIsOpenOneTimeCodeModal(true)}
                                width="100%"
                            >
                                Generate one time code
                            </Button>
                        </GridItem>
                    </SimpleGrid>
                </CardFooter>
            </Card>
            <EditScramblingDeviceModal
                isOpen={isOpenEditDeviceModal}
                onClose={handleCloseEditDeviceModal}
                device={device}
            />
            <OneTimeCodeModal
                isOpen={isOpenOneTimeCodeModal}
                onClose={() => setIsOpenOneTimeCodeModal(false)}
                device={device}
            />
        </>
    );
};

export default ScramblingDeviceCard;
