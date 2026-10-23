import { LayoutGrid, List, Plus, Radio, WandSparkles } from "lucide-react";
import { useContext, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import EmptyState from "@/Components/shared/EmptyState";
import SegmentedControl from "@/Components/shared/SegmentedControl";
import { Button } from "@/Components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";
import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { useIsMobile } from "@/hooks/useMobile";
import { getAllDevices, sortDevicesByName } from "@/lib/devices";
import { AvailableDevice, Device, Room } from "@/lib/interfaces";
import { isAdmin } from "@/lib/permissions";
import { getAllRooms } from "@/lib/rooms";
import { idToHex } from "@/lib/utils";
import SetupTabs from "@/Pages/Main/Setup/SetupTabs";
import { socket, SocketContext } from "@/socket";

import { AutoSetupModal } from "./Components/AutoSetupModal";
import CreateDeviceModal from "./Components/CreateDeviceModal";
import DeviceItem from "./Components/DeviceItem";
import DevicesSettings from "./Tabs/DeviceSettings/DevicesSettings";
import UploadFirmware from "./Tabs/UploadFirmware/UploadFirmware";

type DevicesTab = "allDevices" | "settings" | "uploadFirmware";

const TABS: { value: DevicesTab; label: string; adminOnly?: boolean }[] = [
    { value: "allDevices", label: "All devices" },
    { value: "settings", label: "Settings" },
    { value: "uploadFirmware", label: "Upload firmware", adminOnly: true },
];

const getInitialTab = (param: string | null): DevicesTab => {
    const tab = TABS.find((t) => t.value === param);
    return tab && (!tab.adminOnly || isAdmin()) ? tab.value : "allDevices";
};

const Devices = () => {
    const isMobile = useIsMobile();
    const [searchParams, setSearchParams] = useSearchParams();
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [devices, setDevices] = useState<Device[]>([]);
    const [availableDevices, setAvailableDevices] = useState<AvailableDevice[]>(
        []
    );
    const [tab, setTab] = useState<DevicesTab>(
        getInitialTab(searchParams.get("tab"))
    );
    const [view, setView] = useState<"table" | "cards">("table");
    const [rooms, setRooms] = useState<Room[]>([]);
    const [selectedRoomId, setSelectedRoomId] = useState<string>("ALL");
    const [deviceToAdd, setDeviceToAdd] = useState<AvailableDevice | null>(
        null
    );
    const [isOpenCreateDeviceModal, setIsOpenCreateDeviceModal] =
        useState<boolean>(false);
    const [isAutoSetupModalOpen, setIsAutoSetupModalOpen] = useState(false);

    const fetchData = async (roomIdParam?: string) => {
        setIsLoading(true);
        const data = await getAllDevices(undefined, roomIdParam);
        setDevices(sortDevicesByName(data));
        setIsLoading(false);
    };

    const handleCloseCreateDeviceModal = (device?: Device) => {
        if (device?.id && device?.name) {
            if (deviceToAdd) {
                handleRemoveDeviceRequest(deviceToAdd.espId);
            }
            setDevices((prev) => sortDevicesByName([...prev, device]));
        } else if (device) {
            getAllDevices(undefined, selectedRoomId).then((data) =>
                setDevices(sortDevicesByName(data))
            );
        }
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

    useEffect(() => {
        getAllRooms().then((data) => {
            setRooms(data);
            if (data.length === 1) {
                setSelectedRoomId(data[0].id);
            }
        });
    }, []);

    if (isLoading && devices.length === 0) return <LoadingPage />;

    const handleChangeTab = (value: DevicesTab) => {
        setTab(value);
        setSearchParams({ tab: value });
    };
    const roomName = (roomId: string) =>
        rooms.find((room) => room.id === roomId)?.name;

    const tabSwitch = (
        <SegmentedControl
            label="Devices section"
            value={tab}
            onValueChange={handleChangeTab}
            fullWidth={isMobile}
            options={TABS.filter((t) => !t.adminOnly || isAdmin()).map((t) => ({
                value: t.value,
                label: t.label,
            }))}
        />
    );
    const deviceButtons = (
        <>
            <Button
                variant="outline"
                size={isMobile ? "lg" : "default"}
                className="max-md:flex-1"
                onClick={() => setIsAutoSetupModalOpen(true)}
            >
                <WandSparkles />
                {isMobile ? "Auto setup" : "Auto setup devices"}
            </Button>
            <Button
                size={isMobile ? "lg" : "default"}
                className="max-md:flex-1"
                onClick={() => setIsOpenCreateDeviceModal(true)}
            >
                <Plus />
                Add device
            </Button>
        </>
    );
    const roomSelect = rooms.length > 1 && (
        <Select value={selectedRoomId} onValueChange={handleSelectRoom}>
            <SelectTrigger
                aria-label="Room"
                className="w-auto md:h-9 md:w-[180px]"
            >
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="ALL">All rooms</SelectItem>
                {rooms.map((room) => (
                    <SelectItem value={room.id} key={room.id}>
                        {room.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
    const countLabel =
        devices.length === 1 ? "1 device" : `${devices.length} devices`;

    return (
        <>
            <SetupTabs value="devices" />
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
                {tabSwitch}
                <div className="hidden gap-2 md:ml-auto md:flex">
                    {deviceButtons}
                </div>
            </div>
            {tab === "allDevices" && (
                <>
                    {availableDevices.map((device) => (
                        <div
                            key={device.espId}
                            className="flex flex-col gap-2.5 rounded-xl border border-primary-muted bg-primary-soft px-3.5 py-3 md:flex-row md:items-center md:gap-3 md:py-2.5 md:pl-4 md:pr-2.5"
                        >
                            <span className="flex flex-1 items-center gap-2.5 text-sm">
                                <Radio className="size-5 shrink-0 text-primary" />
                                <span>
                                    New device wants to connect ·{" "}
                                    <b className="font-semibold">
                                        ESP ID {idToHex(device.espId)}
                                    </b>
                                </span>
                            </span>
                            <div className="flex gap-2">
                                <Button
                                    variant={isMobile ? "outline" : "ghost"}
                                    size="sm"
                                    className="max-md:flex-1"
                                    onClick={() =>
                                        handleRemoveDeviceRequest(device.espId)
                                    }
                                >
                                    Dismiss
                                </Button>
                                <Button
                                    size="sm"
                                    className="max-md:flex-1"
                                    onClick={() =>
                                        handleAddDeviceRequest(device)
                                    }
                                >
                                    Add
                                </Button>
                            </div>
                        </div>
                    ))}
                    <p className="text-[13px] text-muted-foreground md:-mt-1.5">
                        To connect a new device, press the submit button on it.
                    </p>
                    {isMobile ? (
                        <>
                            <div className="flex gap-2">{deviceButtons}</div>
                            <div className="flex items-center gap-2.5">
                                <span className="flex-1 text-sm font-semibold">
                                    {countLabel}
                                </span>
                                {roomSelect}
                            </div>
                            {devices.length === 0 ? (
                                <EmptyState>No devices yet</EmptyState>
                            ) : (
                                devices.map((device) => (
                                    <DeviceItem
                                        key={device.id}
                                        device={device}
                                        fetchData={fetchData}
                                        variant="card"
                                        roomName={roomName(device.roomId)}
                                    />
                                ))
                            )}
                        </>
                    ) : (
                        <div className="overflow-hidden rounded-2xl border bg-card">
                            <div className="flex items-center gap-3 border-b px-4 py-3">
                                <span className="flex-1 text-sm font-semibold">
                                    {countLabel}
                                </span>
                                {roomSelect}
                                <SegmentedControl
                                    label="View"
                                    value={view}
                                    onValueChange={setView}
                                    className="[&>button]:w-8 [&>button]:px-0"
                                    options={[
                                        {
                                            value: "table",
                                            label: (
                                                <List className="size-[18px]" />
                                            ),
                                            ariaLabel: "Table",
                                        },
                                        {
                                            value: "cards",
                                            label: (
                                                <LayoutGrid className="size-[18px]" />
                                            ),
                                            ariaLabel: "Cards",
                                        },
                                    ]}
                                />
                            </div>
                            {devices.length === 0 ? (
                                <p className="p-8 text-center text-sm text-muted-foreground">
                                    No devices yet
                                </p>
                            ) : view === "cards" ? (
                                <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-3 p-4">
                                    {devices.map((device) => (
                                        <DeviceItem
                                            key={device.id}
                                            device={device}
                                            fetchData={fetchData}
                                            variant="card"
                                        />
                                    ))}
                                </div>
                            ) : (
                                <Table className="min-w-[860px]">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="pl-5">
                                                Name
                                            </TableHead>
                                            <TableHead>ESP ID</TableHead>
                                            <TableHead>Battery</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Solves</TableHead>
                                            <TableHead>Last update</TableHead>
                                            <TableHead>
                                                <span className="sr-only">
                                                    Actions
                                                </span>
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {devices.map((device) => (
                                            <DeviceItem
                                                key={device.id}
                                                device={device}
                                                fetchData={fetchData}
                                                variant="row"
                                            />
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                    )}
                </>
            )}
            {tab === "settings" && <DevicesSettings />}
            {tab === "uploadFirmware" && <UploadFirmware />}
            <CreateDeviceModal
                isOpen={isOpenCreateDeviceModal}
                onClose={handleCloseCreateDeviceModal}
                deviceToAdd={deviceToAdd || undefined}
            />
            <AutoSetupModal
                open={isAutoSetupModalOpen}
                onClose={() => setIsAutoSetupModalOpen(false)}
            />
        </>
    );
};

export default Devices;
