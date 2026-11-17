import { useState } from "react";

import LogView from "@/Components/LogView/LogView";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/Components/ui/sheet";
import { useSocketEvents } from "@/hooks/useSocketEvents";
import { useSocketRoom } from "@/hooks/useSocketRoom";
import { useToast } from "@/hooks/useToast";
import {
    appendEntries,
    DeviceLogLines,
    DeviceLogSnapshot,
    downloadDeviceLogs,
    LogEntry,
    snapshotEntries,
} from "@/lib/deviceLogs";
import { Device } from "@/lib/interfaces";

interface DeviceLogsSheetProps {
    device: Device;
    isOpen: boolean;
    onClose: () => void;
}

const DOWNLOAD_ERRORS: Record<number, string> = {
    404: "No logs from this station yet",
    503: "Device logs aren't available on this server",
};

/** A device's log, live, for admins (SPEC-009) */
const DeviceLogsSheet = ({ device, isOpen, onClose }: DeviceLogsSheetProps) => {
    const { toast } = useToast();
    const [entries, setEntries] = useState<LogEntry[]>([]);
    /** Null until the first snapshot arrives */
    const [available, setAvailable] = useState<boolean | null>(null);
    const [truncated, setTruncated] = useState(false);

    useSocketRoom(isOpen ? "DeviceLogs" : null, {
        params: { deviceId: device.id },
    });
    useSocketEvents({
        deviceLogSnapshot: (data) => {
            const snapshot = data as DeviceLogSnapshot;
            if (snapshot.deviceId !== device.id) return;
            setEntries(snapshotEntries(snapshot));
            setAvailable(snapshot.available);
            setTruncated(snapshot.truncated);
        },
        deviceLogLines: (data) => {
            const event = data as DeviceLogLines;
            if (event.deviceId !== device.id) return;
            setEntries((previous) => appendEntries(previous, event));
        },
    });

    const handleDownload = async () => {
        const status = await downloadDeviceLogs(device.id, device.name);
        if (status === 200) return;
        toast({
            title: "Error",
            description: DOWNLOAD_ERRORS[status] ?? "Something went wrong",
            variant: "destructive",
        });
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent
                side="right"
                className="flex w-full flex-col gap-3 sm:max-w-3xl"
            >
                <SheetHeader className="pr-10">
                    <SheetTitle>{device.name} logs</SheetTitle>
                    <SheetDescription>
                        Times are when the connector received each line. Lines
                        sent after a reconnect arrive together.
                    </SheetDescription>
                </SheetHeader>
                <LogView
                    label={`${device.name} logs`}
                    entries={entries}
                    available={available}
                    truncated={truncated}
                    unavailableMessage="Device logs aren't available on this server. The backend can't see the connector's logs folder."
                    emptyMessage="No logs from this station yet."
                    onDownload={handleDownload}
                    className="flex-1"
                />
            </SheetContent>
        </Sheet>
    );
};

export default DeviceLogsSheet;
