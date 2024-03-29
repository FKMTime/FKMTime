import { Box, Button, Heading, IconButton, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { MdAdd, MdDevices, MdKey, MdSettings } from "react-icons/md";
import io from "socket.io-client";

import LoadingPage from "@/Components/LoadingPage";
import { getToken } from "@/logic/auth";
import { getAllDevices } from "@/logic/devices";
import { Device } from "@/logic/interfaces";
import { DEVICES_WEBSOCKET_URL, WEBSOCKET_PATH } from "@/logic/request";

import CreateDeviceModal from "./Components/CreateDeviceModal";
import DevicesTable from "./Components/DevicesTable";
import GetApiTokenModal from "./Components/GetApiTokenModal";
import UpdateDevicesSettingsModal from "./Components/UpdateDevicesSettingsModal";

const Devices = () => {
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [devices, setDevices] = useState<Device[]>([]);
    const [availableDevices, setAvailableDevices] = useState<number[]>([]);
    const [espId, setEspId] = useState<number>(0);
    const [isOpenCreateDeviceModal, setIsOpenCreateDeviceModal] =
        useState<boolean>(false);
    const [isOpenGetTokenModal, setIsOpenGetTokenModal] =
        useState<boolean>(false);
    const [
        isOpenUpdateDevicesSettingsModal,
        setIsOpenUpdateDevicesSettingsModal,
    ] = useState<boolean>(false);
    const [socket] = useState(
        io(DEVICES_WEBSOCKET_URL, {
            transports: ["websocket"],
            path: WEBSOCKET_PATH,
            closeOnBeforeunload: true,
            auth: {
                token: getToken(),
            },
        })
    );

    const fetchData = async () => {
        setIsLoading(true);
        const data = await getAllDevices();
        setDevices(data);
        setIsLoading(false);
    };

    const handleCloseCreateDeviceModal = async () => {
        await fetchData();
        setIsOpenCreateDeviceModal(false);
        setEspId(0);
    };

    const handleRemoveDeviceRequest = (deviceEspId: number) => {
        setAvailableDevices(
            availableDevices.filter((id) => id !== deviceEspId)
        );
        socket.emit("removeDeviceRequest", { espId });
    };

    const handleAddDeviceRequest = (deviceEspId: number) => {
        setEspId(deviceEspId);
        setIsOpenCreateDeviceModal(true);
    };

    useEffect(() => {
        fetchData();
        socket.emit("join");

        socket.on("deviceUpdated", () => {
            fetchData();
        });

        socket.on("deviceRequests", (data) => {
            setAvailableDevices(data);
        });

        return () => {
            socket.emit("leave");
        };
    }, [socket]);

    if (isLoading) return <LoadingPage />;

    return (
        <Box display="flex" flexDirection="column" gap="5">
            <Box display="flex" gap="2">
                <IconButton
                    icon={<MdAdd />}
                    aria-label="Add"
                    bg="white"
                    color="black"
                    rounded="20"
                    width="5"
                    height="10"
                    _hover={{
                        background: "white",
                        color: "gray.700",
                    }}
                    title="Add new device"
                    onClick={() => setIsOpenCreateDeviceModal(true)}
                />
                <IconButton
                    icon={<MdSettings />}
                    aria-label="Add"
                    bg="white"
                    color="black"
                    rounded="20"
                    width="5"
                    height="10"
                    _hover={{
                        background: "white",
                        color: "gray.700",
                    }}
                    title="Update devices settings"
                    onClick={() => setIsOpenUpdateDevicesSettingsModal(true)}
                />
                <IconButton
                    icon={<MdKey />}
                    aria-label="Get API token"
                    bg="white"
                    color="black"
                    rounded="20"
                    width="5"
                    height="10"
                    _hover={{
                        background: "white",
                        color: "gray.700",
                    }}
                    title="Get API token"
                    onClick={() => setIsOpenGetTokenModal(true)}
                />
            </Box>
            <DevicesTable devices={devices} fetchData={fetchData} />
            <Heading size="lg">Available devices</Heading>
            <Text size="md">
                Press submit button on device you want to connect
            </Text>
            <Box
                display="flex"
                flexDirection="row"
                gap="5"
                flexWrap="wrap"
                justifyContent={{ base: "center", md: "flex-start" }}
            >
                {availableDevices.map((deviceEspId) => (
                    <Box
                        key={espId}
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
                        <MdDevices size={48} />
                        <Text> Device ID: {deviceEspId}</Text>
                        <Button
                            colorScheme="green"
                            onClick={() => handleAddDeviceRequest(deviceEspId)}
                        >
                            Add
                        </Button>
                        <Button
                            colorScheme="red"
                            onClick={() =>
                                handleRemoveDeviceRequest(deviceEspId)
                            }
                        >
                            Remove
                        </Button>
                    </Box>
                ))}
            </Box>
            <CreateDeviceModal
                isOpen={isOpenCreateDeviceModal}
                onClose={handleCloseCreateDeviceModal}
                espId={espId}
            />
            <UpdateDevicesSettingsModal
                isOpen={isOpenUpdateDevicesSettingsModal}
                onClose={() => setIsOpenUpdateDevicesSettingsModal(false)}
            />
            <GetApiTokenModal
                isOpen={isOpenGetTokenModal}
                handleClose={() => setIsOpenGetTokenModal(false)}
            />
        </Box>
    );
};

export default Devices;
