import { describe, expect, it } from "vitest";
import { Competition as WCIF } from "wcif-helpers";

import { groupDay, noShowGroupIds } from "../attendance";
import { StaffActivity, StaffActivityStatus } from "../interfaces";
import { getPersonSchedule, groupScheduleByDay } from "../personSchedule";

const group = (
    id: number,
    activityCode: string,
    startTime: string,
    endTime: string
) => ({ id, activityCode, name: "", startTime, endTime, childActivities: [] });

const wcif = {
    schedule: {
        venues: [
            {
                timezone: "Europe/Warsaw",
                rooms: [
                    {
                        name: "Main Hall",
                        activities: [
                            {
                                id: 1,
                                activityCode: "333-r1",
                                name: "3x3x3 Cube, Round 1",
                                startTime: "2026-04-18T08:00:00Z",
                                endTime: "2026-04-18T09:00:00Z",
                                childActivities: [
                                    group(
                                        11,
                                        "333-r1-g1",
                                        "2026-04-18T08:00:00Z",
                                        "2026-04-18T08:30:00Z"
                                    ),
                                    group(
                                        12,
                                        "333-r1-g2",
                                        "2026-04-18T08:30:00Z",
                                        "2026-04-18T09:00:00Z"
                                    ),
                                ],
                            },
                            {
                                id: 2,
                                activityCode: "222-r1",
                                name: "2x2x2 Cube, Round 1",
                                startTime: "2026-04-19T08:00:00Z",
                                endTime: "2026-04-19T09:00:00Z",
                                childActivities: [
                                    group(
                                        21,
                                        "222-r1-g1",
                                        "2026-04-19T08:00:00Z",
                                        "2026-04-19T09:00:00Z"
                                    ),
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    },
    persons: [
        {
            registrantId: 7,
            assignments: [
                {
                    activityId: 21,
                    assignmentCode: "staff-scrambler",
                    stationNumber: null,
                },
                {
                    activityId: 12,
                    assignmentCode: "staff-judge",
                    stationNumber: 4,
                },
                {
                    activityId: 11,
                    assignmentCode: "competitor",
                    stationNumber: null,
                },
            ],
        },
    ],
} as unknown as WCIF;

const staffActivity = (
    groupId: string,
    role: string,
    status: StaffActivityStatus,
    isAssigned = true,
    extra: Partial<StaffActivity> = {}
) =>
    ({
        id: `${groupId}-${role}`,
        groupId,
        role,
        status,
        isAssigned,
        ...extra,
    }) as StaffActivity;

// Between the two competition days
const now = new Date("2026-04-18T12:00:00Z");

describe("getPersonSchedule", () => {
    it("lists the assignments in time order with role and station", () => {
        const entries = getPersonSchedule(wcif, 7, [], now);
        expect(
            entries.map((e) => [e.activityCode, e.role, e.stationNumber])
        ).toEqual([
            ["333-r1-g1", "Competitor", null],
            ["333-r1-g2", "Judge", 4],
            ["222-r1-g1", "Scrambler", null],
        ]);
        expect(entries[0]).toMatchObject({
            name: "3x3x3 Cube · Round 1 · Group 1",
            roomName: "Main Hall",
            timezone: "Europe/Warsaw",
        });
    });

    it("is empty for people without a WCIF registration", () => {
        expect(getPersonSchedule(wcif, null, [], now)).toEqual([]);
        expect(getPersonSchedule(wcif, 99, [], now)).toEqual([]);
    });

    it("shows staff attendance, but absence only once the group is over", () => {
        const entries = getPersonSchedule(
            wcif,
            7,
            [
                staffActivity(
                    "333-r1-g1",
                    "COMPETITOR",
                    StaffActivityStatus.PRESENT
                ),
                staffActivity("333-r1-g2", "JUDGE", StaffActivityStatus.ABSENT),
                staffActivity(
                    "222-r1-g1",
                    "SCRAMBLER",
                    StaffActivityStatus.ABSENT
                ),
            ],
            now
        );
        expect(entries.map((e) => e.attendance)).toEqual([
            undefined,
            StaffActivityStatus.ABSENT,
            undefined,
        ]);
    });

    it("adds staffing done without an assignment", () => {
        const entries = getPersonSchedule(
            wcif,
            7,
            [
                staffActivity(
                    "333-r1-g1",
                    "RUNNER",
                    StaffActivityStatus.PRESENT,
                    false
                ),
            ],
            now
        );
        expect(entries.find((e) => e.role === "Runner")).toMatchObject({
            activityCode: "333-r1-g1",
            isAssigned: false,
            attendance: StaffActivityStatus.PRESENT,
        });
    });
});

describe("getPersonSchedule tags", () => {
    it("shows a day off in advance, and who covered or replaced", () => {
        const before = new Date("2026-04-18T07:00:00Z");
        const entries = getPersonSchedule(
            wcif,
            7,
            [
                staffActivity(
                    "333-r1-g2",
                    "JUDGE",
                    StaffActivityStatus.ABSENT,
                    true,
                    {
                        noShow: true,
                        replacedBy: { id: "p2", name: "Ann Cover" },
                    }
                ),
                staffActivity(
                    "222-r1-g1",
                    "SCRAMBLER",
                    StaffActivityStatus.LATE,
                    true,
                    { leftEarly: true }
                ),
            ],
            before
        );
        const judging = entries.find((e) => e.activityCode === "333-r1-g2");
        expect(judging).toMatchObject({
            attendance: StaffActivityStatus.ABSENT,
            noShow: true,
            replacedByName: "Ann Cover",
        });
        const scrambling = entries.find((e) => e.activityCode === "222-r1-g1");
        expect(scrambling).toMatchObject({
            attendance: StaffActivityStatus.LATE,
            leftEarly: true,
        });
    });
});

describe("noShowGroupIds", () => {
    const activities = [
        staffActivity("333-r1-g1", "RUNNER", StaffActivityStatus.ABSENT),
        staffActivity("333-r1-g2", "JUDGE", StaffActivityStatus.ABSENT),
        staffActivity("333-r1-g2", "COMPETITOR", StaffActivityStatus.ABSENT),
        staffActivity("222-r1-g1", "SCRAMBLER", StaffActivityStatus.ABSENT),
    ];

    it("takes the person's staffing that day in groups not over yet", () => {
        expect(groupDay(wcif, "333-r1-g2")).toBe("2026-04-18");
        expect(
            noShowGroupIds(
                wcif,
                activities,
                "2026-04-18",
                new Date("2026-04-18T08:15:00Z")
            )
        ).toEqual(["333-r1-g1", "333-r1-g2"]);
        expect(
            noShowGroupIds(
                wcif,
                activities,
                "2026-04-18",
                new Date("2026-04-18T08:45:00Z")
            )
        ).toEqual(["333-r1-g2"]);
    });

    it("leaves other days alone", () => {
        expect(
            noShowGroupIds(
                wcif,
                activities,
                "2026-04-19",
                new Date("2026-04-18T08:15:00Z")
            )
        ).toEqual(["222-r1-g1"]);
    });
});

describe("groupScheduleByDay", () => {
    it("splits entries by the venue's day", () => {
        const days = groupScheduleByDay(getPersonSchedule(wcif, 7, [], now));
        expect(days.map((d) => [d.day, d.entries.length])).toEqual([
            ["2026-04-18", 2],
            ["2026-04-19", 1],
        ]);
    });
});
