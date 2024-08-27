import { Box, IconButton } from "@chakra-ui/react";
import { useContext, useEffect, useState } from "react";
import { MdSettings } from "react-icons/md";

import LoadingPage from "@/Components/LoadingPage";
import PlusButton from "@/Components/PlusButton.tsx";
import { getAllDevices } from "@/logic/devices";
import { AvailableDevice, Device } from "@/logic/interfaces";
import AvailableDevices from "@/Pages/Devices/Components/AvailableDevices.tsx";
import { socket, SocketContext } from "@/socket";

import CreateDeviceModal from "./Components/CreateDeviceModal";
import DevicesTable from "./Components/DevicesTable";
import UpdateDevicesSettingsModal from "./Components/UpdateDevicesSettingsModal";

const Devices = () => {
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [devices, setDevices] = useState<Device[]>([]);
    const [availableDevices, setAvailableDevices] = useState<AvailableDevice[]>(
        []
    );
    const [deviceToAdd, setDeviceToAdd] = useState<AvailableDevice | null>(
        null
    );
    const [isOpenCreateDeviceModal, setIsOpenCreateDeviceModal] =
        useState<boolean>(false);
    const [
        isOpenUpdateDevicesSettingsModal,
        setIsOpenUpdateDevicesSettingsModal,
    ] = useState<boolean>(false);

    const fetchData = async () => {
        setIsLoading(true);
        const data = await getAllDevices();
        setDevices(data);
        setIsLoading(false);
    };

    const handleCloseCreateDeviceModal = async () => {
        await fetchData();
        setIsOpenCreateDeviceModal(false);
        setDeviceToAdd(null);
    };

    const handleRemoveDeviceRequest = (deviceEspId: number) => {
        setAvailableDevices(
            availableDevices.filter((device) => device.espId !== deviceEspId)
        );
        socket.emit("removeDeviceRequest", { espId: deviceEspId });
    };

    const handleAddDeviceRequest = (device: AvailableDevice) => {
        setDeviceToAdd(device);
        setIsOpenCreateDeviceModal(true);
    };

    const [isConnected] = useContext(SocketContext) as [
        number,
        React.Dispatch<React.SetStateAction<number>>,
    ];
    useEffect(() => {
        fetchData();

        socket.emit("joinDevices");
        socket.on("deviceUpdated", () => {
            fetchData();
        });

        socket.on("deviceRequests", (data) => {
            setAvailableDevices(data);
        });

        return () => {
            socket.emit("leaveDevices");
        };
    }, [isConnected]);

    if (isLoading && devices.length === 0) return <LoadingPage />;

    return (
        <Box display="flex" flexDirection="column" gap="5">
            <Box display="flex" gap="2">
                <PlusButton
                    aria-label="Add"
                    onClick={() => setIsOpenCreateDeviceModal(true)}
                    title="Add new device"
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
            </Box>
            <DevicesTable devices={devices} fetchData={fetchData} />
            <AvailableDevices
                devices={availableDevices}
                handleAddDeviceRequest={handleAddDeviceRequest}
                handleRemoveDeviceRequest={handleRemoveDeviceRequest}
            />
            <CreateDeviceModal
                isOpen={isOpenCreateDeviceModal}
                onClose={handleCloseCreateDeviceModal}
                deviceToAdd={deviceToAdd || undefined}
            />
            <UpdateDevicesSettingsModal
                isOpen={isOpenUpdateDevicesSettingsModal}
                onClose={() => setIsOpenUpdateDevicesSettingsModal(false)}
            />
        </Box>
    );
};

export default Devices;
