import { Box, IconButton } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { MdKey, MdSettings } from "react-icons/md";
import io from "socket.io-client";

import LoadingPage from "@/Components/LoadingPage";
import PlusButton from "@/Components/PlusButton.tsx";
import { getToken } from "@/logic/auth";
import { getAllDevices } from "@/logic/devices";
import { AvailableDevice, Device } from "@/logic/interfaces";
import { DEVICES_WEBSOCKET_URL, WEBSOCKET_PATH } from "@/logic/request";
import AvailableDevices from "@/Pages/Devices/Components/AvailableDevices.tsx";

import CreateDeviceModal from "./Components/CreateDeviceModal";
import DevicesTable from "./Components/DevicesTable";
import GetApiTokenModal from "./Components/GetApiTokenModal";
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
            <GetApiTokenModal
                isOpen={isOpenGetTokenModal}
                handleClose={() => setIsOpenGetTokenModal(false)}
            />
        </Box>
    );
};

export default Devices;
