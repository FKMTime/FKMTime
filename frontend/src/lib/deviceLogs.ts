import { saveAttachment } from "./download";
import { backendRequest } from "./request";

/** Sent when the panel starts watching, and again after the file was reset */
export interface DeviceLogSnapshot {
    deviceId: string;
    /** False when the backend can't see the connector's logs folder */
    available: boolean;
    lines: string[];
    /** There is older history in the file than these lines */
    truncated: boolean;
}

/** New lines since the last event */
export interface DeviceLogLines {
    deviceId: string;
    lines: string[];
    /** Lines the backend left out because the batch was too big */
    skipped: number;
}

export type LogEntry =
    | { id: number; kind: "line"; text: string }
    | { id: number; kind: "skipped"; count: number };

/** Lines kept in the panel; older ones drop off the top */
export const MAX_LOG_ENTRIES = 5000;

let nextId = 0;
const lineEntries = (lines: string[]): LogEntry[] =>
    lines.map((text) => ({ id: nextId++, kind: "line", text }));

/** Works for any log's snapshot: device (SPEC-009) or server (SPEC-011) */
export const snapshotEntries = <T extends Pick<DeviceLogSnapshot, "lines">>(
    snapshot: T
) => lineEntries(snapshot.lines.slice(-MAX_LOG_ENTRIES));

export const appendEntries = <
    T extends Pick<DeviceLogLines, "lines" | "skipped">,
>(
    entries: LogEntry[],
    event: T
): LogEntry[] => {
    const added: LogEntry[] = event.skipped
        ? [
              { id: nextId++, kind: "skipped", count: event.skipped },
              ...lineEntries(event.lines),
          ]
        : lineEntries(event.lines);
    return [...entries, ...added].slice(-MAX_LOG_ENTRIES);
};

export type LogColor = "error" | "warn" | "info" | "debug" | "trace";

export interface LogSegment {
    text: string;
    color: LogColor | null;
}

// The connector colours a station's lines by their level letter
const SGR_COLORS: Record<string, LogColor> = {
    "31": "error",
    "33": "warn",
    "32": "info",
    "34": "debug",
    "35": "trace",
};

// eslint-disable-next-line no-control-regex
const ESCAPE = /\u001b\[([0-9;?]*)([A-Za-z])/g;
// eslint-disable-next-line no-control-regex
const STRAY_ESCAPE = /\u001b/g;

/**
 * Splits a line at its ANSI colour codes. Colours 31–35 and the reset are
 * kept, every other escape sequence is dropped. The result is plain text,
 * never markup.
 */
export const parseAnsi = (line: string): LogSegment[] => {
    const segments: LogSegment[] = [];
    let color: LogColor | null = null;
    let last = 0;
    const push = (text: string) => {
        const clean = text.replace(STRAY_ESCAPE, "");
        if (!clean) return;
        const previous = segments[segments.length - 1];
        if (previous && previous.color === color) previous.text += clean;
        else segments.push({ text: clean, color });
    };

    for (const match of line.matchAll(ESCAPE)) {
        push(line.slice(last, match.index));
        last = match.index + match[0].length;
        if (match[2] !== "m") continue;
        for (const code of match[1].split(";")) {
            if (code === "" || code === "0" || code === "39") color = null;
            else if (SGR_COLORS[code]) color = SGR_COLORS[code];
        }
    }
    push(line.slice(last));
    return segments;
};

/** Saves a log file from the backend; returns the response status */
export const downloadLogFile = async (path: string, fallbackName: string) => {
    const response = await backendRequest(path, "GET", true);
    if (!response.ok) return response.status;
    await saveAttachment(response, `${fallbackName}.log`);
    return response.status;
};

/** Saves a device's whole log file; returns the response status */
export const downloadDeviceLogs = (deviceId: string, fallbackName: string) =>
    downloadLogFile(`device/${deviceId}/logs`, fallbackName);
