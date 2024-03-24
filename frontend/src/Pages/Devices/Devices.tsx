import { useEffect, useState } from "react";
import { getAllDevices } from "../../logic/devices.ts";
import LoadingPage from "../../Components/LoadingPage";
import { Device } from "../../logic/interfaces";
import { Box, Button, Heading, IconButton, Text } from "@chakra-ui/react";
import { MdAdd, MdDevices, MdSettings } from "react-icons/md";
import CreateDeviceModal from "../../Components/Modal/CreateDeviceModal.tsx";
import DevicesTable from "../../Components/Table/DevicesTable.tsx";
import io from "socket.io-client";
import { DEVICES_WEBSOCKET_URL, WEBSOCKET_PATH } from "../../logic/request.ts";
import { getToken } from "../../logic/auth.ts";
import UpdateDevicesSettingsModal from "../../Components/Modal/UpdateDevicesSettingsModal.tsx";

const Devices = (): JSX.Element => {
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [devices, setDevices] = useState<Device[]>([]);
    const [availableDevices, setAvailableDevices] = useState<number[]>([]);
    const [espId, setEspId] = useState<number>(0);
    const [isOpenCreateDeviceModal, setIsOpenCreateDeviceModal] =
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

    const handleRemoveDeviceRequest = (espId: number) => {
        setAvailableDevices(availableDevices.filter((id) => id !== espId));
        socket.emit("removeDeviceRequest", { espId });
    };

    const handleAddDeviceRequest = (espId: number) => {
        setEspId(espId);
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
                    onClick={() => setIsOpenUpdateDevicesSettingsModal(true)}
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
                {availableDevices.map((espId) => (
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
                        <Text> Device ID: {espId}</Text>
                        <Button
                            colorScheme="green"
                            onClick={() => handleAddDeviceRequest(espId)}
                        >
                            Add
                        </Button>
                        <Button
                            colorScheme="red"
                            onClick={() => handleRemoveDeviceRequest(espId)}
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
        </Box>
    );
};

export default Devices;
