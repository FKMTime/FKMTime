import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Competition } from "wcif-helpers";

import {
    AttemptType,
    Device,
    DeviceType,
    Incident,
    Room,
} from "@/lib/interfaces";
import { ConfirmProvider } from "@/providers/ConfirmProvider";

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
            <ConfirmProvider>
                <RoomCard
                    room={room}
                    wcif={wcif}
                    progress={[
                        {
                            groupId: "333-r1-g2",
                            roundId: "333-r1",
                            competitors: 16,
                            finished: 11,
                            entered: 62,
                            expected: 80,
                            expectedIsFinal: false,
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
            </ConfirmProvider>
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
    it("never says a running room starts later; it is ahead", () => {
        // Group 2 is scheduled 09:00–10:00 but already running at 08:00
        renderCard({ now: new Date("2026-04-18T08:00:00Z") });
        expect(screen.getByText("1 h ahead")).toBeTruthy();
        expect(screen.queryByText(/^Starts/)).toBeNull();
    });

    it("shows when an empty room starts its next group", () => {
        renderCard({
            room: { ...room, currentGroupIds: [] },
            nextGroupIds: ["333-r1-g1"],
            now: new Date("2026-04-18T07:00:00Z"),
        });
        expect(screen.getByText("Starts 08:00")).toBeTruthy();
    });

    it("counts the group's place among this room's groups, not its number", () => {
        // Group numbers run across rooms: this room has groups 1 and 3
        const venue = wcif.schedule.venues[0];
        const round = venue.rooms[0].activities[0];
        const crossRoomWcif = {
            ...wcif,
            schedule: {
                venues: [
                    {
                        ...venue,
                        rooms: [
                            {
                                ...venue.rooms[0],
                                activities: [
                                    {
                                        ...round,
                                        childActivities: [
                                            round.childActivities[0],
                                            {
                                                ...round.childActivities[1],
                                                activityCode: "333-r1-g3",
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        } as unknown as Competition;
        renderCard({
            wcif: crossRoomWcif,
            room: { ...room, currentGroupIds: ["333-r1-g3"] },
        });
        expect(
            screen.getByText("Group 3 · 2 of 2 here · 09:00–10:00")
        ).toBeTruthy();
    });

    it("shows the current group, delay, progress and next activity", () => {
        renderCard();
        expect(screen.getByText("3x3x3 Cube · Round 1")).toBeTruthy();
        expect(
            screen.getByText("Group 2 · 2 of 2 here · 09:00–10:00")
        ).toBeTruthy();
        expect(screen.getByText("4 min behind")).toBeTruthy();
        expect(
            screen
                .getByRole("progressbar", {
                    name: "Results entered in Main room",
                })
                .getAttribute("aria-valuenow")
        ).toBe("11");
        expect(screen.getByText("Lunch")).toBeTruthy();
    });

    it("says what the group waits for and marks a no-show from there", async () => {
        const onMarkNotComing = vi.fn();
        renderCard({
            onMarkNotComing,
            progress: [
                {
                    groupId: "333-r1-g2",
                    roundId: "333-r1",
                    competitors: 16,
                    finished: 11,
                    entered: 62,
                    expected: 80,
                    expectedIsFinal: false,
                    wait: {
                        state: "waitingForCompetitors",
                        notStarted: [
                            { personId: "p9", name: "Anna Absent" },
                            // No attendance row to mark them on
                            { personId: null, name: "Rowless Person" },
                        ],
                        solving: 2,
                        incidents: 1,
                        extras: 0,
                        movesOnAt: "2026-04-18T10:20:00Z",
                    },
                },
            ],
        });
        expect(
            screen.getByText(
                "Waiting for 2 competitors solving · 1 incident to resolve"
            )
        ).toBeTruthy();
        expect(screen.getByText("2 not started yet:")).toBeTruthy();
        expect(
            screen.getByText(
                "Moves on by itself at 10:20 if nobody else solves"
            )
        ).toBeTruthy();
        expect(
            screen.queryByRole("button", {
                name: "Rowless Person is not coming",
            })
        ).toBeNull();

        await userEvent.click(
            screen.getByRole("button", { name: "Anna Absent is not coming" })
        );
        expect(onMarkNotComing).toHaveBeenCalledWith(
            { id: "p9", name: "Anna Absent" },
            "333-r1-g2"
        );
    });

    it("is ready to move on once only those not coming are missing", () => {
        renderCard({
            groupControls: {
                rooms: [room],
                getProgress: vi.fn(),
                isAutoChange: true,
                onSetGroups: vi.fn(),
            },
            progress: [
                {
                    groupId: "333-r1-g2",
                    roundId: "333-r1",
                    competitors: 16,
                    finished: 11,
                    entered: 62,
                    expected: 80,
                    expectedIsFinal: false,
                    wait: {
                        state: "finished",
                        notStarted: [],
                        solving: 0,
                        incidents: 0,
                        extras: 0,
                        movesOnAt: null,
                    },
                },
            ],
        });
        expect(screen.getByText("All in · moving on by itself")).toBeTruthy();
        expect(
            screen.queryByLabelText("What the group is waiting for")
        ).toBeNull();
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
                    finished: 16,
                    entered: 80,
                    expected: 80,
                    expectedIsFinal: true,
                },
            ],
        });
        const actions = screen
            .getAllByRole("button")
            .map((b) => b.textContent)
            .filter((t) => /Start group|Enter attempt/.test(t ?? ""));
        expect(actions).toEqual(["Start group 3", "Enter attempt"]);
    });

    it("shows the attempt count only once every total is final", () => {
        renderCard();
        expect(screen.queryByText(/attempts$/)).toBeNull();
        renderCard({
            progress: [
                {
                    groupId: "333-r1-g2",
                    roundId: "333-r1",
                    competitors: 16,
                    finished: 11,
                    entered: 62,
                    expected: 74,
                    expectedIsFinal: true,
                },
            ],
        });
        expect(screen.getByText("62/74 attempts")).toBeTruthy();
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

    describe("stations running another round (SPEC-007)", () => {
        const pointed = {
            id: "dev3",
            name: "Station 3",
            roomId: "room1",
            type: DeviceType.STATION,
            customRoundId: "pyram-r1",
        } as unknown as Device;

        it("lists each one, with a way back for a delegate", async () => {
            const onBackToRoom = vi.fn();
            renderCard({ pointedStations: [pointed], onBackToRoom });

            expect(
                screen.getByText("Station 3 is running Pyraminx · Round 1")
            ).toBeTruthy();
            await userEvent.click(
                screen.getByRole("button", { name: "Back to the room's round" })
            );
            expect(onBackToRoom).toHaveBeenCalledWith(pointed);
        });

        it("lists them without the button for someone who can't change it", () => {
            renderCard({ pointedStations: [pointed] });

            expect(screen.getByText(/Station 3 is running/)).toBeTruthy();
            expect(
                screen.queryByRole("button", {
                    name: "Back to the room's round",
                })
            ).toBeNull();
        });

        it("lists them in a room with no group running", () => {
            renderCard({
                room: { ...room, currentGroupIds: [] },
                pointedStations: [pointed],
            });

            expect(screen.getByText(/Station 3 is running/)).toBeTruthy();
        });
    });
});
