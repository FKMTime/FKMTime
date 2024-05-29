import { Box, IconButton, Td, Text, Tr, useToast } from "@chakra-ui/react";
import { useConfirm } from "chakra-ui-confirm";
import { useState } from "react";
import { MdDelete, MdEdit } from "react-icons/md";

import { deleteDevice } from "@/logic/devices";
import { Device } from "@/logic/interfaces";
import { prettyDeviceType } from "@/logic/utils";

import BatteryIcon from "../../../Components/Icons/BatteryIcon";
import EditDeviceModal from "./EditDeviceModal";

interface DeviceRowProps {
    device: Device;
    fetchData: () => void;
}

const DeviceRow = ({ device, fetchData }: DeviceRowProps) => {
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
            })
            .catch(() => {
                toast({
                    title: "Cancelled",
                    description:
                        "You have cancelled the deletion of the device.",
                    status: "info",
                    duration: 9000,
                    isClosable: true,
                });
            });
    };

    return (
        <>
            <Tr key={device.id}>
                <Td>{device.name}</Td>
                <Td>{device.room.name}</Td>
                <Td>{device.espId}</Td>
                <Td>
                    {device.batteryPercentage && (
                        <Box display="flex" alignItems="center">
                            <BatteryIcon
                                batteryPercentage={device.batteryPercentage}
                            />{" "}
                            <Text>{`${device.batteryPercentage}%`}</Text>
                        </Box>
                    )}
                </Td>
                <Td>{prettyDeviceType(device.type)}</Td>
                <Td>{device.count}</Td>
                <Td>{new Date(device.updatedAt).toLocaleString()}</Td>
                <Td>
                    <IconButton
                        icon={<MdEdit />}
                        aria-label="Edit"
                        bg="none"
                        color="white"
                        _hover={{
                            background: "none",
                            color: "gray.400",
                        }}
                        title="Edit"
                        onClick={() => setIsOpenEditDeviceModal(true)}
                    />
                    <IconButton
                        icon={<MdDelete />}
                        aria-label="Delete"
                        bg="none"
                        color="white"
                        _hover={{
                            background: "none",
                            color: "gray.400",
                        }}
                        title="Delete"
                        onClick={handleDelete}
                    />
                </Td>
            </Tr>
            <EditDeviceModal
                isOpen={isOpenEditDeviceModal}
                onClose={handleCloseEditDeviceModal}
                device={device}
            />
        </>
    );
};

export default DeviceRow;
