import { beforeEach, describe, expect, it } from "vitest";
import { Competition } from "wcif-helpers";

import {
    findGroupSchedule,
    formatScheduleOffset,
    formatTimeRange,
    getNextActivityInRoom,
    getScheduleOffsetMinutes,
    getStartLabel,
} from "@/lib/schedule";

const wcif = {
    schedule: {
        venues: [
            {
                timezone: "Europe/Warsaw",
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
                            {
                                activityCode: "pyram-r1",
                                startTime: "2026-04-18T10:45:00Z",
                                endTime: "2026-04-18T11:30:00Z",
                                childActivities: [],
                            },
                        ],
                    },
                    {
                        name: "Side room",
                        activities: [
                            {
                                activityCode: "333-r1",
                                startTime: "2026-04-18T08:00:00Z",
                                endTime: "2026-04-18T09:00:00Z",
                                childActivities: [
                                    {
                                        activityCode: "333-r1-g3",
                                        startTime: "2026-04-18T08:00:00Z",
                                        endTime: "2026-04-18T09:00:00Z",
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

beforeEach(() => {
    localStorage.setItem(
        "fkmtime-events",
        JSON.stringify([
            { id: "333", name: "3x3x3 Cube", shortName: "3x3" },
            { id: "pyram", name: "Pyraminx", shortName: "Pyra" },
        ])
    );
});

describe("findGroupSchedule", () => {
    it("locates the group, its position and the round end in the room", () => {
        expect(findGroupSchedule(wcif, "333-r1-g2", "Main room")).toEqual({
            groupId: "333-r1-g2",
            roundId: "333-r1",
            roomName: "Main room",
            timezone: "Europe/Warsaw",
            groupNumber: 2,
            groupCount: 2,
            startTime: "2026-04-18T09:00:00Z",
            endTime: "2026-04-18T10:00:00Z",
            roundEndTime: "2026-04-18T10:00:00Z",
        });
    });

    it("respects the room and finds groups scheduled elsewhere", () => {
        expect(
            findGroupSchedule(wcif, "333-r1-g3", "Main room")
        ).toBeUndefined();
        expect(findGroupSchedule(wcif, "333-r1-g3")?.roomName).toBe(
            "Side room"
        );
    });
});

describe("getScheduleOffsetMinutes", () => {
    const start = "2026-04-18T09:00:00Z";
    const end = "2026-04-18T10:00:00Z";

    it("is 0 while the group runs inside its slot", () => {
        expect(
            getScheduleOffsetMinutes(
                start,
                end,
                new Date("2026-04-18T09:30:00Z")
            )
        ).toBe(0);
    });

    it("counts minutes behind once the slot has ended", () => {
        expect(
            getScheduleOffsetMinutes(
                start,
                end,
                new Date("2026-04-18T10:03:30Z")
            )
        ).toBe(4);
    });

    it("counts minutes ahead before the slot starts", () => {
        expect(
            getScheduleOffsetMinutes(
                start,
                end,
                new Date("2026-04-18T08:55:00Z")
            )
        ).toBe(-5);
    });

    it("formats the offset", () => {
        expect(formatScheduleOffset(4)).toBe("+4 min");
        expect(formatScheduleOffset(-5)).toBe("−5 min");
        expect(formatScheduleOffset(0)).toBe("On time");
    });
});

describe("getNextActivityInRoom", () => {
    it("returns the first activity after the round, using names for breaks", () => {
        expect(
            getNextActivityInRoom(wcif, "Main room", "2026-04-18T10:00:00Z")
        ).toEqual({
            name: "Lunch",
            startTime: "2026-04-18T10:00:00Z",
            endTime: "2026-04-18T10:45:00Z",
        });
    });

    it("names rounds by event and round", () => {
        expect(
            getNextActivityInRoom(wcif, "Main room", "2026-04-18T10:30:00Z")
                ?.name
        ).toBe("Pyraminx · Round 1");
    });

    it("returns undefined when nothing is left", () => {
        expect(
            getNextActivityInRoom(wcif, "Main room", "2026-04-18T12:00:00Z")
        ).toBeUndefined();
    });
});

describe("formatTimeRange", () => {
    it("formats in the venue timezone", () => {
        expect(
            formatTimeRange(
                "2026-04-18T08:30:00Z",
                "2026-04-18T10:00:00Z",
                "Europe/Warsaw"
            )
        ).toBe("10:30–12:00");
    });
});

describe("getStartLabel", () => {
    it("names the next group of the same round", () => {
        expect(getStartLabel(["333-r1-g2"], ["333-r1-g3"])).toBe(
            "Start group 3"
        );
    });

    it("names the round when the next group is from another round", () => {
        expect(getStartLabel(["333-r1-g2"], ["pyram-r1-g1"])).toBe(
            "Start Pyra R1 · Group 1"
        );
    });

    it("returns null when the schedule has nothing next", () => {
        expect(getStartLabel(["333-r1-g2"], [])).toBeNull();
    });
});
