import {
    Box,
    Button,
    Tab,
    TabList,
    TabPanel,
    TabPanels,
    Tabs,
} from "@chakra-ui/react";
import { useContext, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import PlusButton from "@/Components/PlusButton.tsx";
import Select from "@/Components/Select";
import { getAllDevices } from "@/lib/devices";
import { AvailableDevice, Device, Room } from "@/lib/interfaces";
import { getAllRooms } from "@/lib/rooms";
import AvailableDevices from "@/Pages/Main/Devices/Components/AvailableDevices";
import { socket, SocketContext } from "@/socket";

import CreateDeviceModal from "./Components/CreateDeviceModal";
import DeviceCard from "./Components/DeviceCard";
import DevicesSettings from "./Components/DevicesSettings";
import DevicesTable from "./Components/DevicesTable";

const tabs = [
    {
        id: "allDevices",
        name: "All devices",
        value: 0,
    },
    {
        id: "availableDevices",
        name: "Available devices",
        value: 1,
    },
    {
        id: "settings",
        name: "Settings",
        value: 2,
    },
];

const Devices = () => {
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [devices, setDevices] = useState<Device[]>([]);
    const [availableDevices, setAvailableDevices] = useState<AvailableDevice[]>(
        []
    );
    const [tabIndex, setTabIndex] = useState<number>(tabs[0].value);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [selectedRoomId, setSelectedRoomId] = useState<string>("");
    const [deviceToAdd, setDeviceToAdd] = useState<AvailableDevice | null>(
        null
    );
    const [isOpenCreateDeviceModal, setIsOpenCreateDeviceModal] =
        useState<boolean>(false);
    const [searchParams, setSearchParams] = useSearchParams();

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

    const onChangeTabIndex = (index: number) => {
        setTabIndex(index);
        const tab = tabs.find((t) => t.value === index)?.id;
        if (!tab) return;
        setSearchParams({ tab: tab });
    };

    useEffect(() => {
        const tab = searchParams.get("tab");
        const index = tabs.find((t) => t.id === tab)?.value;
        if (index) {
            setTabIndex(index);
        }
    }, [searchParams]);

    useEffect(() => {
        getAllRooms().then((data) => {
            setRooms(data);
            setSelectedRoomId(data[0].id);
        });
    }, []);

    if (isLoading && devices.length === 0) return <LoadingPage />;

    return (
        <Box display="flex" flexDirection="column" gap="5">
            <Tabs isFitted index={tabIndex} onChange={onChangeTabIndex}>
                <TabList>
                    {tabs.map((tab) => (
                        <Tab
                            key={tab.id}
                            _selected={{
                                color: "white",
                                bg: "blue.500",
                            }}
                        >
                            {tab.name}
                        </Tab>
                    ))}
                </TabList>
                <TabPanels>
                    <TabPanel
                        display="flex"
                        flexDirection="column"
                        gap={3}
                        ml={-4}
                    >
                        <Box display="flex" gap="2">
                            <Select
                                placeholder="Select room"
                                value={selectedRoomId}
                                onChange={(e) =>
                                    handleSelectRoom(e.target.value)
                                }
                            >
                                {rooms.map((room) => (
                                    <option key={room.id} value={room.id}>
                                        {room.name}
                                    </option>
                                ))}
                            </Select>
                            <PlusButton
                                display={{ base: "flex", md: "none" }}
                                aria-label="Add"
                                onClick={() => setIsOpenCreateDeviceModal(true)}
                                title="Add new device"
                            />
                            <Button
                                colorScheme="green"
                                onClick={() => setIsOpenCreateDeviceModal(true)}
                                display={{ base: "none", md: "flex" }}
                            >
                                Add new device
                            </Button>
                        </Box>
                        <Box display={{ base: "none", md: "block" }}>
                            <DevicesTable
                                devices={devices}
                                fetchData={fetchData}
                            />
                        </Box>
                        <Box
                            display={{ base: "flex", md: "none" }}
                            flexDirection="column"
                            gap={3}
                        >
                            {devices.map((device) => (
                                <DeviceCard
                                    device={device}
                                    key={device.espId}
                                    fetchData={fetchData}
                                />
                            ))}
                        </Box>
                    </TabPanel>
                    <TabPanel ml={-4}>
                        <AvailableDevices
                            devices={availableDevices}
                            handleAddDeviceRequest={handleAddDeviceRequest}
                            handleRemoveDeviceRequest={
                                handleRemoveDeviceRequest
                            }
                        />
                    </TabPanel>
                    <TabPanel width="fit-content" ml={-4}>
                        <DevicesSettings />
                    </TabPanel>
                </TabPanels>
            </Tabs>
            <CreateDeviceModal
                isOpen={isOpenCreateDeviceModal}
                onClose={handleCloseCreateDeviceModal}
                deviceToAdd={deviceToAdd || undefined}
            />
        </Box>
    );
};

export default Devices;
