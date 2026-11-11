import { describe, expect, it } from "vitest";

import { formatDateRange } from "./time";

describe("formatDateRange", () => {
    it("formats a single day", () => {
        expect(formatDateRange("2026-11-14", "2026-11-14")).toBe("14 Nov 2026");
        expect(formatDateRange("2026-11-14")).toBe("14 Nov 2026");
    });

    it("shares the month and year within one month", () => {
        expect(formatDateRange("2026-04-18", "2026-04-19")).toBe(
            "18–19 Apr 2026"
        );
    });

    it("spells out both months across a month boundary", () => {
        expect(formatDateRange("2026-04-30", "2026-05-02")).toBe(
            "30 Apr – 2 May 2026"
        );
    });

    it("spells out both years across a year boundary", () => {
        expect(formatDateRange("2026-12-30", "2027-01-02")).toBe(
            "30 Dec 2026 – 2 Jan 2027"
        );
    });
});
