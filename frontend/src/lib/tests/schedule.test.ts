import { beforeEach, describe, expect, it } from "vitest";
import { Competition } from "wcif-helpers";

import {
    competitionDayToQueryDate,
    findGroupSchedule,
    formatCompetitionDay,
    formatRealTime,
    formatTimeRange,
    getCompetitionDays,
    getDefaultCompetitionDay,
    getNextActivityInRoom,
    getScheduleOffsetMinutes,
    getScheduleRooms,
    getScheduleRoundDetails,
    getScheduleStatus,
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

    it("describes the group's status in words", () => {
        const at = (time: string) => new Date(`2026-04-18T${time}Z`);
        expect(getScheduleStatus(start, end, "UTC", at("09:30:00"))).toEqual({
            label: "On time",
            tone: "success",
        });
        expect(getScheduleStatus(start, end, "UTC", at("10:12:00"))).toEqual({
            label: "12 min behind",
            tone: "warning",
        });
        expect(getScheduleStatus(start, end, "UTC", at("11:05:00"))).toEqual({
            label: "1 h 5 min behind",
            tone: "warning",
        });
        expect(getScheduleStatus(start, end, "UTC", at("08:50:00"))).toEqual({
            label: "10 min ahead",
            tone: "neutral",
        });
    });

    it("shows the start time while the group is more than 15 min away", () => {
        expect(
            getScheduleStatus(
                start,
                end,
                "Europe/Warsaw",
                new Date("2026-04-18T00:12:00Z")
            )
        ).toEqual({ label: "Starts 11:00", tone: "neutral" });
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

describe("getScheduleRooms", () => {
    const venue = (id: number, name: string, rooms: string[]) => ({
        id,
        name,
        timezone: "Europe/Warsaw",
        rooms: rooms.map((room, index) => ({
            id: id * 10 + index,
            name: room,
            activities: [],
        })),
    });

    it("uses the room name when there is one venue", () => {
        const rooms = getScheduleRooms({
            schedule: { venues: [venue(1, "Sports hall", ["Main", "Side"])] },
        } as unknown as Competition);
        expect(rooms.map((room) => [room.key, room.label])).toEqual([
            ["1:10", "Main"],
            ["1:11", "Side"],
        ]);
    });

    it("prefixes the venue when there are several", () => {
        const rooms = getScheduleRooms({
            schedule: {
                venues: [
                    venue(1, "Sports hall", ["Main"]),
                    venue(2, "School", ["Gym"]),
                ],
            },
        } as unknown as Competition);
        expect(rooms.map((room) => room.label)).toEqual([
            "Sports hall · Main",
            "School · Gym",
        ]);
    });
});

describe("competition days", () => {
    it("lists every day from the start date, across a month end", () => {
        expect(getCompetitionDays("2026-04-30", 3)).toEqual([
            "2026-04-30",
            "2026-05-01",
            "2026-05-02",
        ]);
    });

    it("opens on today while the competition runs, else on its first day", () => {
        const days = ["2026-04-18", "2026-04-19"];
        expect(
            getDefaultCompetitionDay(days, new Date(2026, 3, 19, 23, 30))
        ).toBe("2026-04-19");
        expect(getDefaultCompetitionDay(days, new Date(2026, 3, 25))).toBe(
            "2026-04-18"
        );
    });

    it("labels a day and asks the backend about its noon", () => {
        expect(formatCompetitionDay("2026-04-18")).toBe("Sat 18 Apr");
        expect(competitionDayToQueryDate("2026-04-18").toISOString()).toBe(
            "2026-04-18T12:00:00.000Z"
        );
    });
});

describe("formatRealTime", () => {
    it("is null before the first device attempt", () => {
        expect(formatRealTime(null, null)).toBeNull();
    });

    it("shows the start alone while only one attempt is in", () => {
        expect(
            formatRealTime("2026-04-18T08:04:00Z", null, "Europe/Warsaw")
        ).toBe("Started 10:04");
    });

    it("shows the range in the venue's timezone", () => {
        expect(
            formatRealTime(
                "2026-04-18T08:04:00Z",
                "2026-04-18T09:52:00Z",
                "Europe/Warsaw"
            )
        ).toBe("10:04–11:52");
    });
});

describe("getScheduleRoundDetails", () => {
    const competition = {
        events: [
            {
                id: "333",
                rounds: [
                    {
                        id: "333-r1",
                        format: "a",
                        timeLimit: {
                            centiseconds: 60000,
                            cumulativeRoundIds: [],
                        },
                        cutoff: { numberOfAttempts: 2, attemptResult: 3000 },
                        advancementCondition: null,
                    },
                    {
                        id: "333-r2",
                        format: "a",
                        timeLimit: {
                            centiseconds: 60000,
                            cumulativeRoundIds: [],
                        },
                        cutoff: null,
                        participationRuleset: {
                            participationSource: {
                                type: "round",
                                resultCondition: { type: "ranking", value: 16 },
                            },
                        },
                    },
                ],
            },
        ],
    } as unknown as Competition;

    it("describes a round with its limits and how many proceed", () => {
        expect(getScheduleRoundDetails("333-r1", competition)).toMatchObject({
            timeLimit: "10:00.00",
            cutoff: "30.00 (2 attempts)",
            proceeds: "Top 16",
        });
    });

    it("leaves proceed out for the final", () => {
        expect(
            getScheduleRoundDetails("333-r2", competition)?.proceeds
        ).toBeUndefined();
    });

    it("is null for breaks", () => {
        expect(getScheduleRoundDetails("other-lunch", competition)).toBeNull();
    });
});
