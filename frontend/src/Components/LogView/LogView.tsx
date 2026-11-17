import { ArrowDown, Download } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { LogColor, LogEntry, parseAnsi } from "@/lib/deviceLogs";
import { cn } from "@/lib/utils";

interface LogViewProps {
    /** Names the scrolling log for screen readers */
    label: string;
    entries: LogEntry[];
    /** Null until the first snapshot arrives */
    available: boolean | null;
    truncated: boolean;
    unavailableMessage: string;
    emptyMessage: string;
    onDownload: () => void;
    className?: string;
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

/**
 * A live log: a filter, a download button, and the lines, following new ones
 * while scrolled to the bottom (SPEC-009, SPEC-011)
 */
const LogView = ({
    label,
    entries,
    available,
    truncated,
    unavailableMessage,
    emptyMessage,
    onDownload,
    className,
}: LogViewProps) => {
    const [filter, setFilter] = useState("");
    const [following, setFollowing] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);

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

    return (
        <div className={cn("flex min-h-0 flex-col gap-3", className)}>
            {available !== false && (
                <div className="flex items-center gap-2">
                    <Input
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder="Filter lines"
                        aria-label="Filter lines"
                        className="flex-1"
                    />
                    <Button variant="outline" size="sm" onClick={onDownload}>
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
                    aria-label={label}
                    className="h-full overflow-y-auto rounded-lg border bg-background p-3 font-mono text-xs leading-5"
                >
                    {available === false ? (
                        <p className="text-muted-foreground">
                            {unavailableMessage}
                        </p>
                    ) : available === null ? (
                        <p className="text-muted-foreground">Loading…</p>
                    ) : entries.length === 0 ? (
                        <p className="text-muted-foreground">{emptyMessage}</p>
                    ) : (
                        <>
                            {truncated && !filter && (
                                <p className="pb-1 text-muted-foreground">
                                    Older lines aren't shown. Download the file
                                    to see them all.
                                </p>
                            )}
                            {visible.map((entry) =>
                                entry.kind === "line" ? (
                                    <LogLine key={entry.id} text={entry.text} />
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
        </div>
    );
};

export default LogView;
