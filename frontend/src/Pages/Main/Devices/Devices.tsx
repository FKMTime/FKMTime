import { TabsContent } from "@radix-ui/react-tabs";
import { Microchip } from "lucide-react";
import { useContext, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import PlusButton from "@/Components/PlusButton.tsx";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/Components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/Components/ui/tabs";
import { getAllDevices } from "@/lib/devices";
import { AvailableDevice, Device, Room } from "@/lib/interfaces";
import { isAdmin } from "@/lib/permissions";
import { getAllRooms } from "@/lib/rooms";
import PageTransition from "@/Pages/PageTransition";
import { socket, SocketContext } from "@/socket";

import CreateDeviceModal from "./Components/CreateDeviceModal";
import DeviceCard from "./Components/DeviceCard";
import DevicesTable from "./Components/DevicesTable";
import DevicesSettings from "./Tabs/DeviceSettings/DevicesSettings";
import UploadFirmware from "./Tabs/UploadFirmware/UploadFirmware";

const tabs = [
    {
        id: "allDevices",
        name: "All devices",
    },
    {
        id: "settings",
        name: "Settings",
    },
    {
        id: "uploadFirmware",
        name: "Upload firmware",
        disabled: !isAdmin(),
    },
];

const Devices = () => {
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [devices, setDevices] = useState<Device[]>([]);
    const [availableDevices, setAvailableDevices] = useState<AvailableDevice[]>(
        []
    );
    const [tabIndex, setTabIndex] = useState<string>(tabs[0].id);
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

    const handleCloseCreateDeviceModal = async (espId?: string) => {
        if (
            espId &&
            availableDevices.some((device) => device.espId === +espId)
        ) {
            handleRemoveDeviceRequest(+espId);
        }
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

        socket.on("deviceRequests", (data: AvailableDevice[]) => {
            setAvailableDevices(data);
        });

        return () => {
            socket.emit("leaveDevices");
        };
    }, [isConnected]);

    const onChangeTab = (id: string) => {
        setTabIndex(id);
        const tab = tabs.find((t) => t.id === id)?.id;
        if (!tab) return;
        setSearchParams({ tab: tab });
    };

    useEffect(() => {
        const tab = searchParams.get("tab");
        const index = tabs.find((t) => t.id === tab)?.id;
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
        <PageTransition>
            <Tabs defaultValue={tabIndex} className="flex flex-col gap-3">
                <Card className="mb-2">
                    <CardHeader>
                        <CardTitle className="flex justify-between items-center">
                            <div className="flex gap-2 items-center">
                                <Microchip size={20} />
                                Devices
                            </div>
                            <PlusButton
                                onClick={() => setIsOpenCreateDeviceModal(true)}
                                title="Add new device"
                            />
                        </CardTitle>
                        <CardDescription>
                            If you want to connect a new device press submit
                            button on this device
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <TabsList>
                            {tabs.map((tab) => (
                                <TabsTrigger
                                    key={tab.id}
                                    value={tab.id}
                                    onClick={() => onChangeTab(tab.id)}
                                    disabled={tab.disabled}
                                >
                                    {tab.name}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </CardContent>
                </Card>
                <TabsContent value={tabs[0].id}>
                    <div className="hidden md:block">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex justify-between items-center">
                                    <div className="flex gap-2 items-center">
                                        <Microchip size={20} />
                                        Devices
                                    </div>
                                    <div className="w-64">
                                        <Select
                                            value={selectedRoomId}
                                            onValueChange={handleSelectRoom}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select room" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {rooms.map((room) => (
                                                    <SelectItem value={room.id}>
                                                        {room.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <DevicesTable
                                    devices={devices}
                                    fetchData={fetchData}
                                    availableDevices={availableDevices}
                                    handleAddDeviceRequest={
                                        handleAddDeviceRequest
                                    }
                                    handleRemoveDeviceRequest={
                                        handleRemoveDeviceRequest
                                    }
                                />
                            </CardContent>
                        </Card>
                    </div>
                    <div className="flex md:hidden flex-col gap-3">
                        {devices.map((device) => (
                            <DeviceCard
                                device={device}
                                key={device.espId}
                                fetchData={fetchData}
                            />
                        ))}
                    </div>
                </TabsContent>
                <TabsContent value={tabs[1].id}>
                    <DevicesSettings />
                </TabsContent>
                <TabsContent value={tabs[2].id}>
                    <UploadFirmware />
                </TabsContent>
                <CreateDeviceModal
                    isOpen={isOpenCreateDeviceModal}
                    onClose={handleCloseCreateDeviceModal}
                    deviceToAdd={deviceToAdd || undefined}
                />
            </Tabs>
        </PageTransition>
    );
};

export default Devices;
