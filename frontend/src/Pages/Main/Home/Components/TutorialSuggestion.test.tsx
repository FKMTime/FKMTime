import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Competition as WCIF } from "wcif-helpers";

import { Device, DeviceType, HardwareVersion, Room } from "@/lib/interfaces";

import TutorialStationsAlert from "./TutorialStationsAlert";
import TutorialSuggestion from "./TutorialSuggestion";

const now = new Date("2026-11-17T09:00:00Z");

const wcif = {
    schedule: {
        venues: [
            {
                timezone: "UTC",
                rooms: [
                    {
                        id: 1,
                        name: "Main Hall",
                        activities: [
                            {
                                id: 7,
                                name: "Tutorial for new competitors",
                                activityCode: "other-tutorial",
                                startTime: "2026-11-17T09:10:00Z",
                                endTime: "2026-11-17T09:30:00Z",
                            },
                        ],
                    },
                ],
            },
        ],
    },
} as unknown as WCIF;

const rooms: Room[] = [
    { id: "room-1", name: "Main Hall", currentGroupIds: [], color: "#000" },
];

const station = (overrides: Partial<Device> = {}): Device => ({
    id: "device-1",
    name: "Station 3",
    espId: 3,
    roomId: "room-1",
    type: DeviceType.STATION,
    hwVersion: HardwareVersion.V4,
    createdAt: now,
    updatedAt: now,
    ...overrides,
});

describe("Home tutorial banners (SPEC-012)", () => {
    beforeEach(() => {
        vi.useFakeTimers({ now, shouldAdvanceTime: true });
        localStorage.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("suggests the schedule's tutorial and starts it on the room's one station", async () => {
        const onStart = vi.fn();
        render(
            <TutorialSuggestion
                wcif={wcif}
                rooms={rooms}
                stations={[station()]}
                onStart={onStart}
            />
        );

        expect(
            screen.getByText(/Tutorial for new competitors, Main Hall, 09:10/)
        ).toBeTruthy();
        await userEvent.click(
            screen.getByRole("button", { name: "Start tutorial on Station 3" })
        );
        expect(onStart).toHaveBeenCalledWith(
            expect.objectContaining({ id: "device-1" })
        );
    });

    it("goes away once a station in the room is in tutorial mode", () => {
        render(
            <TutorialSuggestion
                wcif={wcif}
                rooms={rooms}
                stations={[station({ tutorialEndsAt: "2026-11-17T09:15:00Z" })]}
                onStart={vi.fn()}
            />
        );

        expect(screen.queryByText(/Tutorial for new competitors/)).toBeNull();
    });

    it("stays dismissed", async () => {
        const props = {
            wcif,
            rooms,
            stations: [station()],
            onStart: vi.fn(),
        };
        const { unmount } = render(<TutorialSuggestion {...props} />);

        await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
        expect(screen.queryByText(/Tutorial for new competitors/)).toBeNull();

        unmount();
        render(<TutorialSuggestion {...props} />);
        expect(screen.queryByText(/Tutorial for new competitors/)).toBeNull();
    });

    it("warns about stations in tutorial mode, with a way to end it", async () => {
        const onEnd = vi.fn();
        render(
            <TutorialStationsAlert
                stations={[
                    station({ tutorialEndsAt: "2026-11-17T09:15:00Z" }),
                    station({ id: "device-2", name: "Station 4" }),
                ]}
                onEnd={onEnd}
            />
        );

        expect(screen.getByText("Station 3 is in tutorial mode")).toBeTruthy();
        expect(screen.queryByText("Station 4")).toBeNull();
        await userEvent.click(
            screen.getByRole("button", { name: "End tutorial" })
        );
        expect(onEnd).toHaveBeenCalledWith(
            expect.objectContaining({ id: "device-1" })
        );
    });

    it("shows nothing once the tutorial has ended", () => {
        const { container } = render(
            <TutorialStationsAlert
                stations={[station({ tutorialEndsAt: "2026-11-17T08:59:00Z" })]}
            />
        );

        expect(container.innerHTML).toBe("");
    });
});
