import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StationLastError } from "@/lib/interfaces";
import { STATION_ERROR_TTL_MS } from "@/lib/stationErrors";

import StationErrorIcon from "./StationErrorIcon";

const NOW = new Date("2026-03-01T10:00:00Z").getTime();

const lastError = (
    overrides: Partial<StationLastError> = {}
): StationLastError => ({
    key: "competitorNotFound",
    kind: "problem",
    message: "Competitor not found",
    at: new Date(NOW - 4 * 60_000).toISOString(),
    count: 1,
    cardId: "3004",
    competitorName: null,
    ...overrides,
});

describe("StationErrorIcon", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    const renderIcon = (value: StationLastError | null) => {
        vi.useFakeTimers({ now: NOW, toFake: ["Date", "setInterval"] });
        return render(<StationErrorIcon lastError={value} />);
    };

    it("shows nothing without an error", () => {
        renderIcon(null);

        expect(screen.queryByRole("button")).toBeNull();
    });

    it.each([
        ["problem", "lucide-triangle-alert", "text-destructive"],
        ["rule", "lucide-info", "text-muted-foreground"],
    ] as const)("marks a %s with its icon and tone", (kind, icon, tone) => {
        renderIcon(lastError({ kind }));

        const trigger = screen.getByRole("button", {
            name: "Competitor not found",
        });
        expect(trigger.className).toContain(tone);
        expect(trigger.querySelector("svg")?.getAttribute("class")).toContain(
            icon
        );
    });

    it("explains what to do, with the card, the repeats and the age", async () => {
        renderIcon(lastError({ count: 3, competitorName: "Example Person" }));
        vi.useRealTimers();

        await userEvent.click(screen.getByRole("button"));

        expect(screen.getByText("×3")).toBeTruthy();
        expect(
            screen.getByText(
                "Card 3004 isn't assigned. Assign it on the Cards page."
            )
        ).toBeTruthy();
        expect(screen.getByText("4 min ago · Example Person")).toBeTruthy();
    });

    it("shows the station's text alone for a key it doesn't know", async () => {
        renderIcon(lastError({ key: "somethingNew", message: "New text" }));
        vi.useRealTimers();

        await userEvent.click(screen.getByRole("button"));

        expect(screen.getAllByText("New text").length).toBeGreaterThan(0);
        expect(screen.queryByText(/Assign it/)).toBeNull();
    });

    it("hides an error once it is 10 minutes old", () => {
        renderIcon(lastError({ at: new Date(NOW).toISOString() }));
        expect(screen.getByRole("button")).toBeTruthy();

        act(() => {
            vi.advanceTimersByTime(STATION_ERROR_TTL_MS);
        });

        expect(screen.queryByRole("button")).toBeNull();
    });
});
