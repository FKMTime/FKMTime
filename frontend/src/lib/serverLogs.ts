import { downloadLogFile } from "./deviceLogs";

/** The server logs admins can read (SPEC-011) */
export type ServerLogSource = "backend" | "connector" | "unix";

export const SERVER_LOG_SOURCES: { value: ServerLogSource; label: string }[] = [
    { value: "backend", label: "Backend" },
    { value: "connector", label: "Connector" },
    { value: "unix", label: "Connector ↔ backend messages" },
];

/** Sent when the page starts watching, and again after the file was reset */
export interface ServerLogSnapshot {
    source: ServerLogSource;
    /** False when the backend can't see the log's folder */
    available: boolean;
    lines: string[];
    /** There is older history in the file than these lines */
    truncated: boolean;
}

/** New lines since the last event */
export interface ServerLogLines {
    source: ServerLogSource;
    lines: string[];
    /** Lines the backend left out because the batch was too big */
    skipped: number;
}

/** Saves a server log's whole file; returns the response status */
export const downloadServerLog = (source: ServerLogSource) =>
    downloadLogFile(`server-logs/${source}`, source);
