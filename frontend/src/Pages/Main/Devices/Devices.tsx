import { LayoutGrid, List, Plus, Radio } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import EmptyState from "@/Components/shared/EmptyState";
import RequestError from "@/Components/shared/RequestError";
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
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useIsMobile } from "@/hooks/useMobile";
import { useSocketEvents } from "@/hooks/useSocketEvents";
import { useSocketRoom } from "@/hooks/useSocketRoom";
import { useToast } from "@/hooks/useToast";
import {
    devicesQuery,
    reconnectDevice,
    retiredDevicesQuery,
    sortDevicesByName,
} from "@/lib/devices";
import {
    AvailableDevice,
    Device,
    DeviceSignalEvent,
    DeviceType,
} from "@/lib/interfaces";
import { isAdmin } from "@/lib/permissions";
import { patchQueryData, setQueryData } from "@/lib/queryCache";
import { roomsQuery } from "@/lib/rooms";
import { idToHex } from "@/lib/utils";
import { socket } from "@/socket";

import { AutoSetupSwitch } from "./Components/AutoSetupSwitch";
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
    const { toast } = useToast();
    const [searchParams, setSearchParams] = useSearchParams();
    const [availableDevices, setAvailableDevices] = useState<AvailableDevice[]>(
        []
    );
    const [tab, setTab] = useState<DevicesTab>(
        getInitialTab(searchParams.get("tab"))
    );
    const [view, setView] = useState<"table" | "cards">("table");
    const { data: rooms = [] } = useLiveQuery(roomsQuery);
    const [selectedRoomId, setSelectedRoomId] = useState<string>("ALL");
    const {
        data: fetchedDevices,
        isError,
        refetch,
    } = useLiveQuery(devicesQuery);
    const setDevices = (update: (previous?: Device[]) => Device[]) =>
        setQueryData(devicesQuery.key, update);
    // Filtering here keeps switching rooms instant
    const devices = sortDevicesByName(
        (fetchedDevices ?? []).filter(
            (device) =>
                selectedRoomId === "ALL" || device.roomId === selectedRoomId
        )
    );
    const { data: retiredDevices = [], refetch: refetchRetired } =
        useLiveQuery(retiredDevicesQuery);
    const [deviceToAdd, setDeviceToAdd] = useState<AvailableDevice | null>(
        null
    );
    const [isOpenCreateDeviceModal, setIsOpenCreateDeviceModal] =
        useState<boolean>(false);
    // Local time the server switches auto setup off at (null while off), and
    // how long a run lasts
    const [autoSetup, setAutoSetup] = useState<{
        endsAt: number | null;
        durationMs: number;
    }>({ endsAt: null, durationMs: 0 });

    const fetchData = () => {
        void refetch();
        void refetchRetired();
    };

    const handleCloseCreateDeviceModal = (device?: Device) => {
        if (device?.id && device?.name) {
            if (deviceToAdd) {
                handleRemoveDeviceRequest(deviceToAdd.espId);
            }
            setDevices((prev) => [...(prev ?? []), device]);
        } else if (device) {
            fetchData();
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

    const handleReconnectDevice = async (device: AvailableDevice) => {
        if (!device.existingDevice) return;
        const status = await reconnectDevice(device.existingDevice.id);
        if (status === 200) {
            setAvailableDevices((prev) =>
                prev.filter((d) => d.espId !== device.espId)
            );
            fetchData();
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
        }
    };

    const handleAddDeviceRequest = (device: AvailableDevice) => {
        setDeviceToAdd(device);
        setIsOpenCreateDeviceModal(true);
    };

    // Joined again on every reconnect; useRefetchOnReconnect picks up
    // device changes missed while disconnected
    useSocketRoom("Devices");
    useSocketEvents({
        deviceUpdated: fetchData,
        // Every few seconds per station, so one row is patched in place
        // instead of refetching the list (SPEC-008)
        deviceSignal: (data) => {
            const { espId, ...signal } = data as DeviceSignalEvent;
            patchQueryData<Device[]>(devicesQuery.key, (previous) =>
                previous.map((device) =>
                    device.espId === espId && device.type === DeviceType.STATION
                        ? { ...device, signal }
                        : device
                )
            );
        },
        deviceRequests: (data) =>
            setAvailableDevices(data as AvailableDevice[]),
        // Sent on joining the room and on every change; the time left rather
        // than the deadline, so a skewed local clock still counts down right
        autoSetupStatus: (data) => {
            const { remainingMs, durationMs } = data as {
                remainingMs: number | null;
                durationMs: number;
            };
            setAutoSetup({
                endsAt: remainingMs === null ? null : Date.now() + remainingMs,
                durationMs,
            });
        },
    });

    if (!fetchedDevices) {
        return isError ? <RequestError onRetry={fetchData} /> : <LoadingPage />;
    }

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
            <AutoSetupSwitch
                endsAt={autoSetup.endsAt}
                durationMs={autoSetup.durationMs}
            />
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
        <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
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
                                    {device.existingDevice
                                        ? `${device.existingDevice.name} wants to reconnect · `
                                        : "New device wants to connect · "}
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
                                {device.existingDevice ? (
                                    <Button
                                        size="sm"
                                        className="max-md:flex-1"
                                        onClick={() =>
                                            handleReconnectDevice(device)
                                        }
                                    >
                                        Reconnect
                                    </Button>
                                ) : (
                                    <Button
                                        size="sm"
                                        className="max-md:flex-1"
                                        onClick={() =>
                                            handleAddDeviceRequest(device)
                                        }
                                    >
                                        Add
                                    </Button>
                                )}
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
                                            <TableHead>Signal</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Firmware</TableHead>
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
                    {retiredDevices.length > 0 && (
                        <details className="rounded-2xl border bg-card">
                            <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold">
                                Retired devices ({retiredDevices.length})
                                <span className="ml-2 font-normal text-muted-foreground">
                                    Kept so their solves keep their station
                                </span>
                            </summary>
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-3 border-t p-4">
                                {sortDevicesByName([...retiredDevices]).map(
                                    (device) => (
                                        <DeviceItem
                                            key={device.id}
                                            device={device}
                                            fetchData={fetchData}
                                            variant="card"
                                            roomName={roomName(device.roomId)}
                                        />
                                    )
                                )}
                            </div>
                        </details>
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
        </>
    );
};

export default Devices;
