import { describe, expect, it } from "vitest";

import {
    appendEntries,
    MAX_LOG_ENTRIES,
    parseAnsi,
    snapshotEntries,
} from "./deviceLogs";

const ESC = "\u001b";

describe("parseAnsi", () => {
    it("leaves a line without escapes as one plain segment", () => {
        expect(parseAnsi("Client connected")).toEqual([
            { text: "Client connected", color: null },
        ]);
    });

    it("colours a station line by its level and ends at the reset", () => {
        expect(
            parseAnsi(`time  INFO x: ${ESC}[31mE card error${ESC}[0m done`)
        ).toEqual([
            { text: "time  INFO x: ", color: null },
            { text: "E card error", color: "error" },
            { text: " done", color: null },
        ]);
    });

    it.each([
        ["33", "warn"],
        ["32", "info"],
        ["34", "debug"],
        ["35", "trace"],
    ])("maps colour %s to %s", (code, color) => {
        expect(parseAnsi(`${ESC}[${code}mtext${ESC}[0m`)).toEqual([
            { text: "text", color },
        ]);
    });

    it("drops other escape sequences and stray escape characters", () => {
        expect(parseAnsi(`a${ESC}[2Kb${ESC}[1mc${ESC}d`)).toEqual([
            { text: "abcd", color: null },
        ]);
    });

    it("keeps markup as text", () => {
        expect(parseAnsi("<b>bold</b>")).toEqual([
            { text: "<b>bold</b>", color: null },
        ]);
    });
});

describe("log entries", () => {
    const snapshot = (lines: string[]) =>
        snapshotEntries({
            deviceId: "d",
            available: true,
            lines,
            truncated: false,
        });

    it("appends new lines after the snapshot", () => {
        const entries = appendEntries(snapshot(["one"]), {
            deviceId: "d",
            lines: ["two"],
            skipped: 0,
        });

        expect(
            entries.map((e) => (e.kind === "line" ? e.text : e.count))
        ).toEqual(["one", "two"]);
    });

    it("marks skipped lines before the batch", () => {
        const entries = appendEntries([], {
            deviceId: "d",
            lines: ["two"],
            skipped: 3,
        });

        expect(entries[0]).toMatchObject({ kind: "skipped", count: 3 });
        expect(entries[1]).toMatchObject({ kind: "line", text: "two" });
    });

    it(`keeps at most ${MAX_LOG_ENTRIES} entries, dropping the oldest`, () => {
        const many = Array.from({ length: MAX_LOG_ENTRIES }, (_, i) => `${i}`);

        const entries = appendEntries(snapshot(many), {
            deviceId: "d",
            lines: ["new"],
            skipped: 0,
        });

        expect(entries).toHaveLength(MAX_LOG_ENTRIES);
        expect(entries[0]).toMatchObject({ text: "1" });
        expect(entries.at(-1)).toMatchObject({ text: "new" });
    });
});
