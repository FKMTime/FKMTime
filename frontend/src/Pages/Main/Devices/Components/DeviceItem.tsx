import {
    ArchiveRestore,
    Nfc,
    Pencil,
    Route,
    Timer,
    Trash2,
    Undo2,
} from "lucide-react";
import { useState } from "react";

import BatteryIcon from "@/Components/Icons/BatteryIcon";
import SignalIcon from "@/Components/Icons/SignalIcon";
import PointedStationBadge from "@/Components/shared/PointedStationBadge";
import RowActions from "@/Components/shared/RowActions";
import RunDifferentRoundModal from "@/Components/shared/RunDifferentRoundModal";
import { TableCell, TableRow } from "@/Components/ui/table";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import { deleteDevice, restoreDevice, setStationsRound } from "@/lib/devices";
import { Device, DeviceType } from "@/lib/interfaces";
import { isDelegate } from "@/lib/permissions";
import { cn, idToHex, prettyDeviceType } from "@/lib/utils";

import EditDeviceModal from "./EditDeviceModal";

interface DeviceItemProps {
    device: Device;
    fetchData: () => void;
    variant: "row" | "card";
    /** Room name, shown on mobile cards */
    roomName?: string;
}

const batteryTone = (percentage?: number) => {
    if (percentage == null) return { text: "", bar: "bg-track" };
    if (percentage < 20)
        return { text: "text-destructive", bar: "bg-destructive" };
    if (percentage < 50) return { text: "", bar: "bg-warning" };
    return { text: "", bar: "bg-success" };
};

/** A device as a table row or a card, with edit and delete actions */
const DeviceItem = ({
    device,
    fetchData,
    variant,
    roomName,
}: DeviceItemProps) => {
    const { toast } = useToast();
    const confirm = useConfirm();
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isRoundOpen, setIsRoundOpen] = useState(false);
    const canPoint =
        isDelegate() && device.type === DeviceType.STATION && !device.retiredAt;

    const handleDelete = () => {
        confirm({
            title: "Delete device",
            description: `Are you sure you want to delete ${device.name}? If it has recorded solves, it moves to retired devices instead, so those solves keep their station`,
            confirmLabel: "Delete device",
        })
            .then(async () => {
                const status = await deleteDevice(device.id);
                if (status === 204) {
                    fetchData();
                } else {
                    toast({
                        title: "Error",
                        description: "Something went wrong",
                        variant: "destructive",
                    });
                }
            })
            .catch(() => {
                // Declined: closing the dialog is feedback enough
            });
    };

    const handleRestore = async () => {
        const status = await restoreDevice(device.id);
        if (status === 200) {
            fetchData();
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
        }
    };

    const handleBackToRoom = async () => {
        const status = await setStationsRound([device.id], null);
        if (status === 200) {
            fetchData();
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
        }
    };

    const actions = (
        <RowActions
            subject={device.name}
            primary={{
                label: "Edit device",
                icon: Pencil,
                onSelect: () => setIsEditOpen(true),
            }}
            items={[
                {
                    label: "Run a different round…",
                    icon: Route,
                    onSelect: () => setIsRoundOpen(true),
                    hidden: !canPoint,
                },
                {
                    label: "Back to the room's round",
                    icon: Undo2,
                    onSelect: handleBackToRoom,
                    hidden: !canPoint || !device.customRoundId,
                },
                {
                    label: "Restore device",
                    icon: ArchiveRestore,
                    onSelect: handleRestore,
                    hidden: !device.retiredAt,
                },
                {
                    label: "Delete device",
                    icon: Trash2,
                    destructive: true,
                    onSelect: handleDelete,
                    hidden: !!device.retiredAt,
                },
            ]}
        />
    );
    const modal = (
        <>
            <EditDeviceModal
                isOpen={isEditOpen}
                onClose={() => {
                    fetchData();
                    setIsEditOpen(false);
                }}
                device={device}
            />
            {canPoint && (
                <RunDifferentRoundModal
                    isOpen={isRoundOpen}
                    onClose={() => {
                        fetchData();
                        setIsRoundOpen(false);
                    }}
                    initialStationIds={[device.id]}
                    initialRoundId={device.customRoundId ?? undefined}
                />
            )}
        </>
    );
    const pointedBadge = device.customRoundId && !device.retiredAt && (
        <PointedStationBadge
            roundId={device.customRoundId}
            since={device.customRoundSetAt}
        />
    );
    const battery = device.batteryPercentage;
    const battText = battery != null ? `${battery}%` : "—";
    const tone = batteryTone(battery);
    const updatedAt = new Date(device.updatedAt).toLocaleString();
    const type = prettyDeviceType(device.type);
    const firmware = device.firmwareVersion || "—";
    // Stations only; retired ones aren't on the network
    const signal =
        device.type === DeviceType.STATION && !device.retiredAt
            ? device.signal
            : undefined;

    if (variant === "row")
        return (
            <TableRow>
                <TableCell className="whitespace-nowrap pl-5 font-semibold">
                    <span className="flex items-center gap-2">
                        {device.name}
                        {pointedBadge}
                    </span>
                </TableCell>
                <TableCell className="font-mono text-[13px] text-muted-foreground">
                    {idToHex(device.espId)}
                </TableCell>
                <TableCell>
                    <span
                        className={cn(
                            "flex items-center gap-1.5 whitespace-nowrap [&>svg]:size-[18px] [&>svg]:text-muted-foreground",
                            tone.text
                        )}
                    >
                        {battery != null && (
                            <BatteryIcon batteryPercentage={battery} />
                        )}
                        {battText}
                    </span>
                </TableCell>
                <TableCell>
                    {signal && <SignalIcon signal={signal} />}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                    {type}{" "}
                    <span className="text-faint">({device.hwVersion})</span>
                </TableCell>
                <TableCell className="whitespace-nowrap font-mono text-[13px] text-muted-foreground">
                    {firmware}
                </TableCell>
                <TableCell>{device.count}</TableCell>
                <TableCell className="text-muted-foreground">
                    {updatedAt}
                </TableCell>
                <TableCell className="pr-3">
                    {actions}
                    {modal}
                </TableCell>
            </TableRow>
        );

    const TypeIcon = device.type === DeviceType.STATION ? Timer : Nfc;
    return (
        <article
            aria-label={device.name}
            className="flex flex-col gap-3 rounded-mobile-card border bg-card py-3 pl-3.5 pr-1 md:rounded-xl md:bg-background md:p-3.5"
        >
            <div className="flex items-center gap-2.5 md:items-start">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                    <TypeIcon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">
                        {device.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                        {[type, device.hwVersion, roomName]
                            .filter(Boolean)
                            .join(" · ")}
                    </p>
                    {pointedBadge && <div className="mt-1">{pointedBadge}</div>}
                </div>
                <div className="md:-mr-1 md:-mt-1">{actions}</div>
            </div>
            <div className="flex flex-col gap-1.5 pr-2.5 md:pr-0">
                {signal && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Wi-Fi signal</span>
                        <SignalIcon signal={signal} />
                    </div>
                )}
                <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Battery</span>
                    <span className={cn("font-semibold", tone.text)}>
                        {battText}
                    </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-track">
                    <div
                        className={cn("h-full", tone.bar)}
                        style={{ width: `${battery ?? 0}%` }}
                    />
                </div>
            </div>
            <div className="flex justify-between gap-2 border-t pr-2.5 pt-2.5 text-xs text-muted-foreground md:pr-0">
                <span>
                    <b className="font-semibold text-foreground">
                        {device.count ?? 0}
                    </b>{" "}
                    solves
                </span>
                <span>{updatedAt}</span>
            </div>
            <span className="font-mono text-[11px] text-faint">
                ESP {idToHex(device.espId)} · Firmware {firmware}
            </span>
            {modal}
        </article>
    );
};

export default DeviceItem;
