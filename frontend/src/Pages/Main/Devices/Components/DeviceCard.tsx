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

import BatteryIcon from "@/Components/Icons/BatteryIcon";
import { deleteDevice } from "@/logic/devices";
import { Device } from "@/logic/interfaces";
import { prettyDeviceType } from "@/logic/utils";

import EditDeviceModal from "./EditDeviceModal";

interface DeviceCardProps {
    device: Device;
    fetchData: () => void;
}

const DeviceCard = ({ device, fetchData }: DeviceCardProps) => {
    const toast = useToast();
    const confirm = useConfirm();
    const [isOpenEditDeviceModal, setIsOpenEditDeviceModal] =
        useState<boolean>(false);

    const handleCloseEditDeviceModal = async () => {
        fetchData();
        setIsOpenEditDeviceModal(false);
    };

    const handleDelete = async () => {
        confirm({
            title: "Delete device",
            description:
                "Are you sure you want to delete this device? This action cannot be undone",
        })
            .then(async () => {
                const status = await deleteDevice(device.id);
                if (status === 204) {
                    toast({
                        title: "Successfully deleted device.",
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
                        {device.batteryPercentage && (
                            <Box display="flex" alignItems="center">
                                <BatteryIcon
                                    batteryPercentage={device.batteryPercentage}
                                />{" "}
                                <Text>{`${device.batteryPercentage}%`}</Text>
                            </Box>
                        )}
                    </Box>
                    <Stack mt="3" spacing="1">
                        <Text>ESP ID: {device.espId}</Text>
                        <Text>Type: {prettyDeviceType(device.type)}</Text>
                        <Text>Attempts: {device.count}</Text>
                        <Text>
                            Updated at:{" "}
                            {new Date(device.updatedAt).toLocaleString()}
                        </Text>
                    </Stack>
                </CardBody>
                <Divider />
                <CardFooter>
                    <ButtonGroup spacing="2">
                        <Button
                            variant="solid"
                            colorScheme="blue"
                            onClick={() => setIsOpenEditDeviceModal(true)}
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
            <EditDeviceModal
                isOpen={isOpenEditDeviceModal}
                onClose={handleCloseEditDeviceModal}
                device={device}
            />
        </>
    );
};

export default DeviceCard;
