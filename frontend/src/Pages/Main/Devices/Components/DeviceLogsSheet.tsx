import { ArrowDown, Download } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
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
    LogColor,
    LogEntry,
    parseAnsi,
    snapshotEntries,
} from "@/lib/deviceLogs";
import { Device } from "@/lib/interfaces";

interface DeviceLogsSheetProps {
    device: Device;
    isOpen: boolean;
    onClose: () => void;
}

const COLOR_CLASSES: Record<LogColor, string> = {
    error: "text-destructive",
    warn: "text-warning",
    info: "text-success",
    debug: "text-primary",
    trace: "text-muted-foreground",
};

/** How close to the bottom still counts as following new lines, in px */
const FOLLOW_SLACK_PX = 24;

const DOWNLOAD_ERRORS: Record<number, string> = {
    404: "No logs from this station yet",
    503: "Device logs aren't available on this server",
};

const LogLine = ({ text }: { text: string }) => (
    <div className="whitespace-pre-wrap break-all">
        {parseAnsi(text).map((segment, index) => (
            <span
                key={index}
                className={segment.color ? COLOR_CLASSES[segment.color] : ""}
            >
                {segment.text}
            </span>
        ))}
    </div>
);

/** A device's log, live, for admins (SPEC-009) */
const DeviceLogsSheet = ({ device, isOpen, onClose }: DeviceLogsSheetProps) => {
    const { toast } = useToast();
    const [entries, setEntries] = useState<LogEntry[]>([]);
    /** Null until the first snapshot arrives */
    const [available, setAvailable] = useState<boolean | null>(null);
    const [truncated, setTruncated] = useState(false);
    const [filter, setFilter] = useState("");
    const [following, setFollowing] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);

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

    const visible = useMemo(() => {
        const query = filter.trim().toLowerCase();
        if (!query) return entries;
        return entries.filter(
            (entry) =>
                entry.kind === "line" &&
                parseAnsi(entry.text)
                    .map((segment) => segment.text)
                    .join("")
                    .toLowerCase()
                    .includes(query)
        );
    }, [entries, filter]);

    useLayoutEffect(() => {
        const element = scrollRef.current;
        if (following && element) element.scrollTop = element.scrollHeight;
    }, [visible, following]);

    const handleScroll = () => {
        const element = scrollRef.current;
        if (!element) return;
        setFollowing(
            element.scrollHeight - element.scrollTop - element.clientHeight <=
                FOLLOW_SLACK_PX
        );
    };

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
                {available !== false && (
                    <div className="flex items-center gap-2">
                        <Input
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            placeholder="Filter lines"
                            aria-label="Filter lines"
                            className="flex-1"
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDownload}
                        >
                            <Download />
                            Download
                        </Button>
                    </div>
                )}
                <div className="relative min-h-0 flex-1">
                    <div
                        ref={scrollRef}
                        onScroll={handleScroll}
                        role="log"
                        aria-label={`${device.name} logs`}
                        className="h-full overflow-y-auto rounded-lg border bg-background p-3 font-mono text-xs leading-5"
                    >
                        {available === false ? (
                            <p className="text-muted-foreground">
                                Device logs aren't available on this server. The
                                backend can't see the connector's logs folder.
                            </p>
                        ) : available === null ? (
                            <p className="text-muted-foreground">Loading…</p>
                        ) : entries.length === 0 ? (
                            <p className="text-muted-foreground">
                                No logs from this station yet.
                            </p>
                        ) : (
                            <>
                                {truncated && !filter && (
                                    <p className="pb-1 text-muted-foreground">
                                        Older lines aren't shown. Download the
                                        file to see them all.
                                    </p>
                                )}
                                {visible.map((entry) =>
                                    entry.kind === "line" ? (
                                        <LogLine
                                            key={entry.id}
                                            text={entry.text}
                                        />
                                    ) : (
                                        <p
                                            key={entry.id}
                                            className="text-muted-foreground"
                                        >
                                            … {entry.count} lines skipped
                                        </p>
                                    )
                                )}
                            </>
                        )}
                    </div>
                    {!following && (
                        <Button
                            size="sm"
                            className="absolute bottom-3 left-1/2 -translate-x-1/2 shadow-popover"
                            onClick={() => setFollowing(true)}
                        >
                            <ArrowDown />
                            Jump to latest
                        </Button>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
};

export default DeviceLogsSheet;
