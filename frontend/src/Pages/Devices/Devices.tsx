import {
    Box,
    IconButton,
    Tab,
    TabList,
    TabPanel,
    TabPanels,
    Tabs,
} from "@chakra-ui/react";
import { useContext, useEffect, useState } from "react";
import { MdSettings } from "react-icons/md";

import LoadingPage from "@/Components/LoadingPage";
import PlusButton from "@/Components/PlusButton.tsx";
import Select from "@/Components/Select";
import { getAllDevices } from "@/logic/devices";
import { AvailableDevice, Device, Room } from "@/logic/interfaces";
import { getAllRooms } from "@/logic/rooms";
import AvailableDevices from "@/Pages/Devices/Components/AvailableDevices.tsx";
import { socket, SocketContext } from "@/socket";

import CreateDeviceModal from "./Components/CreateDeviceModal";
import DeviceCard from "./Components/DeviceCard";
import DevicesTable from "./Components/DevicesTable";
import UpdateDevicesSettingsModal from "./Components/UpdateDevicesSettingsModal";

const Devices = () => {
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [devices, setDevices] = useState<Device[]>([]);
    const [availableDevices, setAvailableDevices] = useState<AvailableDevice[]>(
        []
    );
    const [rooms, setRooms] = useState<Room[]>([]);
    const [selectedRoomId, setSelectedRoomId] = useState<string>("");
    const [deviceToAdd, setDeviceToAdd] = useState<AvailableDevice | null>(
        null
    );
    const [isOpenCreateDeviceModal, setIsOpenCreateDeviceModal] =
        useState<boolean>(false);
    const [
        isOpenUpdateDevicesSettingsModal,
        setIsOpenUpdateDevicesSettingsModal,
    ] = useState<boolean>(false);

    const fetchData = async (roomIdParam?: string) => {
        setIsLoading(true);
        const data = await getAllDevices(undefined, roomIdParam);
        setDevices(data);
        setIsLoading(false);
    };

    const handleCloseCreateDeviceModal = async () => {
        await fetchData(selectedRoomId);
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

    const handleSelectRoom = (roomId: string) => {
        setSelectedRoomId(roomId);
        fetchData(roomId);
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

    useEffect(() => {
        getAllRooms().then((data) => {
            setRooms(data);
            setSelectedRoomId(data[0].id);
        });
    }, []);

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
            <Box width={{ base: "100%", md: "fit-content" }}>
                <Select
                    placeholder="Select room"
                    value={selectedRoomId}
                    onChange={(e) => handleSelectRoom(e.target.value)}
                >
                    {rooms.map((room) => (
                        <option key={room.id} value={room.id}>
                            {room.name}
                        </option>
                    ))}
                </Select>
            </Box>
            <Box display={{ base: "none", md: "block" }}>
                <DevicesTable devices={devices} fetchData={fetchData} />
            </Box>
            <Box display={{ base: "block", md: "none" }}>
                <Tabs isFitted>
                    <TabList>
                        <Tab
                            _selected={{
                                color: "white",
                                bg: "blue.500",
                            }}
                        >
                            All
                        </Tab>
                        <Tab _selected={{ color: "white", bg: "blue.500" }}>
                            Available
                        </Tab>
                    </TabList>
                    <TabPanels>
                        <TabPanel display="flex" flexDirection="column" gap={3}>
                            {devices.map((device) => (
                                <DeviceCard
                                    device={device}
                                    key={device.espId}
                                    fetchData={fetchData}
                                />
                            ))}
                        </TabPanel>
                        <TabPanel>
                            <AvailableDevices
                                devices={availableDevices}
                                handleAddDeviceRequest={handleAddDeviceRequest}
                                handleRemoveDeviceRequest={
                                    handleRemoveDeviceRequest
                                }
                            />
                        </TabPanel>
                    </TabPanels>
                </Tabs>
            </Box>
            <Box display={{ base: "none", md: "block" }}>
                <AvailableDevices
                    devices={availableDevices}
                    handleAddDeviceRequest={handleAddDeviceRequest}
                    handleRemoveDeviceRequest={handleRemoveDeviceRequest}
                />
            </Box>
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
