import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Competition } from "wcif-helpers";

import RoundPicker from "./RoundPicker";

const activity = (activityCode: string, startTime: string) => ({
    activityCode,
    startTime,
});

// Schedule order: 3x3 R1, 2x2 R1, 3x3 R2, 2x2 R2, then Pyra R1 unscheduled
const wcif = {
    events: [
        { id: "333", rounds: [{ id: "333-r1" }, { id: "333-r2" }] },
        { id: "222", rounds: [{ id: "222-r1" }, { id: "222-r2" }] },
        { id: "pyram", rounds: [{ id: "pyram-r1" }] },
    ],
    schedule: {
        venues: [
            {
                timezone: "UTC",
                rooms: [
                    {
                        activities: [
                            activity("333-r1", "2026-05-01T09:00:00Z"),
                            activity("222-r1", "2026-05-01T10:30:00Z"),
                            activity("333-r2", "2026-05-02T09:00:00Z"),
                            activity("222-r2", "2026-05-02T11:00:00Z"),
                        ],
                    },
                ],
            },
        ],
    },
} as unknown as Competition;

beforeEach(() => {
    localStorage.setItem(
        "fkmtime-events",
        JSON.stringify([
            { id: "333", name: "3x3x3 Cube", shortName: "3x3" },
            { id: "222", name: "2x2x2 Cube", shortName: "2x2" },
            { id: "pyram", name: "Pyraminx", shortName: "Pyra" },
        ])
    );
});

const timeline = () =>
    screen.getByRole("radiogroup", { name: "Rounds by schedule" });

describe("RoundPicker on desktop", () => {
    it("shows the selected round's day of the schedule, with live rounds", () => {
        const { rerender } = render(
            <RoundPicker
                wcif={wcif}
                liveRoundIds={["222-r1"]}
                value="333-r1"
                onValueChange={vi.fn()}
                timeline
            />
        );
        const labels = () =>
            within(timeline())
                .getAllByRole("radio")
                .map((r) => r.getAttribute("aria-label"));
        expect(labels()).toEqual(["3x3 R1", "2x2 R1, live"]);
        expect(within(timeline()).getByText("Friday")).toBeTruthy();
        expect(
            within(timeline())
                .getByRole("radio", { name: "3x3 R1" })
                .getAttribute("aria-checked")
        ).toBe("true");

        rerender(
            <RoundPicker
                wcif={wcif}
                liveRoundIds={["222-r1"]}
                value="333-r2"
                onValueChange={vi.fn()}
                timeline
            />
        );
        expect(labels()).toEqual(["3x3 R2", "2x2 R2"]);
        expect(within(timeline()).getByText("Saturday")).toBeTruthy();
        expect(within(timeline()).getByText("11:00")).toBeTruthy();
    });

    it("shows the live round's day when no round is picked", () => {
        render(
            <RoundPicker
                wcif={wcif}
                liveRoundIds={["222-r2"]}
                value=""
                clearLabel="All rounds"
                onValueChange={vi.fn()}
                timeline
            />
        );
        expect(within(timeline()).getByText("Saturday")).toBeTruthy();
    });

    it("finds any round from the grid, filtered by typing", async () => {
        const onValueChange = vi.fn();
        render(
            <RoundPicker
                wcif={wcif}
                liveRoundIds={[]}
                value="333-r1"
                onValueChange={onValueChange}
                timeline
            />
        );
        await userEvent.click(
            screen.getByRole("button", { name: /^Find a round/ })
        );
        await userEvent.click(
            await screen.findByRole("button", { name: "2x2x2 Cube · Round 2" })
        );
        expect(onValueChange).toHaveBeenLastCalledWith("222-r2");

        await userEvent.click(
            screen.getByRole("button", { name: /^Find a round/ })
        );
        await userEvent.type(screen.getByLabelText("Search events"), "pyra");
        expect(
            screen.queryByRole("button", { name: "3x3x3 Cube · Round 1" })
        ).toBeNull();
        await userEvent.keyboard("{Enter}");
        expect(onValueChange).toHaveBeenLastCalledWith("pyram-r1");
    });

    it("opens an event on its live round when picked by typing", async () => {
        const onValueChange = vi.fn();
        render(
            <RoundPicker
                wcif={wcif}
                liveRoundIds={["222-r2"]}
                value="333-r1"
                onValueChange={onValueChange}
            />
        );
        await userEvent.click(
            screen.getByRole("button", { name: /^Find a round/ })
        );
        await userEvent.type(screen.getByLabelText("Search events"), "2x2");
        await userEvent.keyboard("{Enter}");
        expect(onValueChange).toHaveBeenLastCalledWith("222-r2");
    });

    it("steps to the previous and next round of the schedule", async () => {
        const onValueChange = vi.fn();
        render(
            <RoundPicker
                wcif={wcif}
                liveRoundIds={[]}
                value="222-r1"
                onValueChange={onValueChange}
                timeline
                steps
            />
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Previous round: 3x3 R1" })
        );
        expect(onValueChange).toHaveBeenLastCalledWith("333-r1");
        await userEvent.click(
            screen.getByRole("button", { name: "Next round: 3x3 R2" })
        );
        expect(onValueChange).toHaveBeenLastCalledWith("333-r2");
    });

    it("stops at the end of the schedule", () => {
        render(
            <RoundPicker
                wcif={wcif}
                liveRoundIds={[]}
                value="pyram-r1"
                onValueChange={vi.fn()}
                steps
            />
        );
        expect(
            (
                screen.getByRole("button", {
                    name: "Next round",
                }) as HTMLButtonElement
            ).disabled
        ).toBe(true);
    });

    it("offers an option that clears the round", async () => {
        const onValueChange = vi.fn();
        render(
            <RoundPicker
                wcif={wcif}
                liveRoundIds={[]}
                value="333-r2"
                clearLabel="All rounds"
                onValueChange={onValueChange}
                timeline
            />
        );
        await userEvent.click(
            screen.getByRole("button", { name: /^Find a round/ })
        );
        await userEvent.click(
            await screen.findByRole("button", { name: "All rounds" })
        );
        expect(onValueChange).toHaveBeenLastCalledWith("");
    });
});

describe("RoundPicker on a phone", () => {
    beforeEach(() => {
        window.innerWidth = 375;
    });
    afterEach(() => {
        window.innerWidth = 1024;
    });

    it("picks the event from a dropdown, then its round", async () => {
        const onValueChange = vi.fn();
        render(
            <RoundPicker
                wcif={wcif}
                liveRoundIds={["333-r2"]}
                value="333-r1"
                onValueChange={onValueChange}
                timeline
            />
        );
        expect(
            screen.queryByRole("radiogroup", { name: "Rounds by schedule" })
        ).toBeNull();
        await userEvent.click(
            screen.getByRole("radio", { name: "Round 2, live" })
        );
        expect(onValueChange).toHaveBeenLastCalledWith("333-r2");

        await userEvent.click(screen.getByRole("combobox", { name: "Event" }));
        await userEvent.click(
            await screen.findByRole("option", { name: "Pyraminx" })
        );
        expect(onValueChange).toHaveBeenLastCalledWith("pyram-r1");
    });

    it("hides the round switch for a one-round event", () => {
        render(
            <RoundPicker
                wcif={wcif}
                liveRoundIds={[]}
                value="pyram-r1"
                onValueChange={vi.fn()}
            />
        );
        expect(screen.queryByRole("radiogroup", { name: "Round" })).toBeNull();
    });
});
