import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import LogView from "@/Components/LogView/LogView";
import PageTabs from "@/Components/shared/PageTabs";
import { usePageHeader } from "@/hooks/usePageHeader";
import { useSocketEvents } from "@/hooks/useSocketEvents";
import { useSocketRoom } from "@/hooks/useSocketRoom";
import { useToast } from "@/hooks/useToast";
import { appendEntries, LogEntry, snapshotEntries } from "@/lib/deviceLogs";
import { isAdmin } from "@/lib/permissions";
import {
    downloadServerLog,
    SERVER_LOG_SOURCES,
    ServerLogLines,
    ServerLogSnapshot,
    ServerLogSource,
} from "@/lib/serverLogs";
import NotFound from "@/Pages/Main/NotFound/NotFound";

const EMPTY_MESSAGES: Record<ServerLogSource, string> = {
    backend: "Nothing logged yet.",
    connector:
        "No connector log yet. Older connectors don't write one; update the connector to get it.",
    unix: "Nothing logged yet.",
};

const DOWNLOAD_ERRORS: Record<number, string> = {
    404: "Nothing logged yet",
    503: "This log isn't available on this server",
};

const sourceFrom = (param: string | null): ServerLogSource =>
    SERVER_LOG_SOURCES.find((source) => source.value === param)?.value ??
    "backend";

/** One server log, live; remounted for each source so nothing carries over */
const ServerLog = ({ source }: { source: ServerLogSource }) => {
    const { toast } = useToast();
    const [entries, setEntries] = useState<LogEntry[]>([]);
    /** Null until the first snapshot arrives */
    const [available, setAvailable] = useState<boolean | null>(null);
    const [truncated, setTruncated] = useState(false);
    const label =
        SERVER_LOG_SOURCES.find((option) => option.value === source)?.label ??
        source;

    useSocketRoom("ServerLogs", { params: { source } });
    useSocketEvents({
        serverLogSnapshot: (data) => {
            const snapshot = data as ServerLogSnapshot;
            if (snapshot.source !== source) return;
            setEntries(snapshotEntries(snapshot));
            setAvailable(snapshot.available);
            setTruncated(snapshot.truncated);
        },
        serverLogLines: (data) => {
            const event = data as ServerLogLines;
            if (event.source !== source) return;
            setEntries((previous) => appendEntries(previous, event));
        },
    });

    const handleDownload = async () => {
        const status = await downloadServerLog(source);
        if (status === 200) return;
        toast({
            title: "Error",
            description: DOWNLOAD_ERRORS[status] ?? "Something went wrong",
            variant: "destructive",
        });
    };

    return (
        <LogView
            label={`${label} log`}
            entries={entries}
            available={available}
            truncated={truncated}
            unavailableMessage="This log isn't available on this server."
            emptyMessage={EMPTY_MESSAGES[source]}
            onDownload={handleDownload}
            className="h-[calc(100dvh-14rem)] min-h-80"
        />
    );
};

/** The backend's and the connector's own logs, for admins (SPEC-011) */
const ServerLogs = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const source = sourceFrom(searchParams.get("tab"));
    usePageHeader({ crumbs: [{ label: "Server logs" }], title: "Server logs" });

    if (!isAdmin()) return <NotFound />;

    return (
        <>
            <PageTabs
                label="Log"
                value={source}
                onValueChange={(value) => setSearchParams({ tab: value })}
                tabs={SERVER_LOG_SOURCES}
                className="max-md:-mt-4 max-md:bg-card"
            />
            <ServerLog key={source} source={source} />
        </>
    );
};

export default ServerLogs;
