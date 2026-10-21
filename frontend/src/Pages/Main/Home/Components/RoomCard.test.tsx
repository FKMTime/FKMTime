import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Competition } from "wcif-helpers";

import { AttemptType, Incident, Room } from "@/lib/interfaces";

import RoomCard, { RecentAttempt } from "./RoomCard";

const wcif = {
    schedule: {
        venues: [
            {
                timezone: "UTC",
                rooms: [
                    {
                        name: "Main room",
                        activities: [
                            {
                                activityCode: "333-r1",
                                startTime: "2026-04-18T08:00:00Z",
                                endTime: "2026-04-18T10:00:00Z",
                                childActivities: [
                                    {
                                        activityCode: "333-r1-g1",
                                        startTime: "2026-04-18T08:00:00Z",
                                        endTime: "2026-04-18T09:00:00Z",
                                    },
                                    {
                                        activityCode: "333-r1-g2",
                                        startTime: "2026-04-18T09:00:00Z",
                                        endTime: "2026-04-18T10:00:00Z",
                                    },
                                ],
                            },
                            {
                                activityCode: "other-lunch",
                                name: "Lunch",
                                startTime: "2026-04-18T10:00:00Z",
                                endTime: "2026-04-18T10:45:00Z",
                                childActivities: [],
                            },
                        ],
                    },
                ],
            },
        ],
    },
} as unknown as Competition;

const room: Room = {
    id: "room1",
    name: "Main room",
    currentGroupIds: ["333-r1-g2"],
    color: "",
};

const incident = {
    id: "inc1",
    device: { name: "Station 4", roomId: "room1" },
    judge: { name: "Jan Test" },
    result: { person: { name: "Anna Example" } },
} as unknown as Incident;

const recent = {
    "333-r1": [
        {
            id: "att1",
            attemptNumber: 4,
            type: AttemptType.STANDARD_ATTEMPT,
            value: 994,
            penalty: 0,
            result: { id: "res1", person: { id: "p1", name: "Andrew Sample" } },
        },
    ] as unknown as RecentAttempt[],
};

const renderCard = (props: Partial<Parameters<typeof RoomCard>[0]> = {}) => {
    const handlers = { onStartNext: vi.fn(), onEnterAttempt: vi.fn() };
    render(
        <MemoryRouter>
            <RoomCard
                room={room}
                wcif={wcif}
                progress={[
                    {
                        groupId: "333-r1-g2",
                        roundId: "333-r1",
                        competitors: 16,
                        entered: 62,
                        expected: 80,
                    },
                ]}
                incidents={[incident]}
                recentAttempts={recent}
                nextGroupIds={["333-r1-g3"]}
                now={new Date("2026-04-18T10:04:00Z")}
                canEnterAttempts
                canOpenAttendance
                canResolveIncidents
                {...handlers}
                {...props}
            />
        </MemoryRouter>
    );
    return handlers;
};

beforeEach(() => {
    localStorage.setItem(
        "fkmtime-events",
        JSON.stringify([{ id: "333", name: "3x3x3 Cube", shortName: "3x3" }])
    );
});

describe("RoomCard", () => {
    it("shows the current group, delay, progress and next activity", () => {
        renderCard();
        expect(screen.getByText("3x3x3 Cube · Round 1")).toBeTruthy();
        expect(screen.getByText("Group 2 of 2 · 09:00–10:00")).toBeTruthy();
        expect(screen.getByText("4 min behind")).toBeTruthy();
        expect(
            screen
                .getByRole("progressbar", {
                    name: "Results entered in Main room",
                })
                .getAttribute("aria-valuenow")
        ).toBe("62");
        expect(screen.getByText("Lunch")).toBeTruthy();
    });

    it("lists incidents with station and judge, and recent results", () => {
        renderCard();
        expect(screen.getByText("Station 4 · Judge Jan Test")).toBeTruthy();
        expect(
            screen.getByRole("link", { name: "Resolve" }).getAttribute("href")
        ).toBe("/incidents/inc1");
        expect(screen.getByText("Andrew Sample")).toBeTruthy();
        expect(screen.getByText("Attempt 4")).toBeTruthy();
        expect(screen.getByText("9.94")).toBeTruthy();
    });

    it("starts the next group and opens quick entry for the round", async () => {
        const { onStartNext, onEnterAttempt } = renderCard();
        await userEvent.click(
            screen.getByRole("button", { name: "Start group 3" })
        );
        expect(onStartNext).toHaveBeenCalledWith(room, ["333-r1-g3"]);
        await userEvent.click(
            screen.getByRole("button", { name: "Enter attempt" })
        );
        expect(onEnterAttempt).toHaveBeenCalledWith("333-r1");
        expect(
            screen
                .getByRole("link", { name: "Attendance" })
                .getAttribute("href")
        ).toBe("/attendance/333-r1-g2");
    });

    it("puts Start next group last while results are still coming in", () => {
        renderCard();
        const actions = screen
            .getAllByRole("button")
            .map((b) => b.textContent)
            .filter((t) => /Start group|Enter attempt/.test(t ?? ""));
        expect(actions).toEqual(["Enter attempt", "Start group 3"]);
    });

    it("makes Start next group the first action once the group is done", () => {
        renderCard({
            progress: [
                {
                    groupId: "333-r1-g2",
                    roundId: "333-r1",
                    competitors: 16,
                    entered: 80,
                    expected: 80,
                },
            ],
        });
        const actions = screen
            .getAllByRole("button")
            .map((b) => b.textContent)
            .filter((t) => /Start group|Enter attempt/.test(t ?? ""));
        expect(actions).toEqual(["Start group 3", "Enter attempt"]);
    });

    it("hides actions and incidents the user cannot use", () => {
        renderCard({
            canEnterAttempts: false,
            canOpenAttendance: false,
            canResolveIncidents: false,
            nextGroupIds: undefined,
        });
        expect(
            screen.queryByRole("button", { name: /Start group/ })
        ).toBeNull();
        expect(
            screen.queryByRole("button", { name: "Enter attempt" })
        ).toBeNull();
        expect(screen.queryByText("Anna Example")).toBeNull();
    });

    it("offers the next group when nothing is in progress", () => {
        renderCard({
            room: { ...room, currentGroupIds: [] },
            nextGroupIds: ["333-r1-g1"],
            now: new Date("2026-04-18T07:30:00Z"),
        });
        expect(screen.getByText("No group in progress")).toBeTruthy();
        expect(
            screen.getByRole("button", { name: "Start 3x3 R1 · Group 1" })
        ).toBeTruthy();
        expect(screen.queryByRole("progressbar")).toBeNull();
    });
});
