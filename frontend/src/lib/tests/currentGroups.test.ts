import { beforeEach, describe, expect, it } from "vitest";
import { Competition } from "wcif-helpers";

import {
    canAddGroup,
    getGroupOptions,
    getStartedRounds,
    roundLabel,
    shortGroupLabel,
} from "@/lib/currentGroups";

const group = (activityCode: string) => ({ activityCode, childActivities: [] });

const wcif = {
    events: [
        { id: "333", rounds: [{ id: "333-r1" }] },
        { id: "pyram", rounds: [{ id: "pyram-r1" }] },
    ],
    schedule: {
        venues: [
            {
                rooms: [
                    {
                        activities: [
                            {
                                activityCode: "333-r1",
                                childActivities: [
                                    group("333-r1-g2"),
                                    group("333-r1-g1"),
                                ],
                            },
                            {
                                activityCode: "pyram-r1",
                                childActivities: [group("pyram-r1-g1")],
                            },
                        ],
                    },
                ],
            },
        ],
    },
} as unknown as Competition;

describe("current groups", () => {
    beforeEach(() => {
        localStorage.setItem(
            "fkmtime-events",
            JSON.stringify([
                { id: "333", name: "3x3x3 Cube", shortName: "3x3" },
                { id: "pyram", name: "Pyraminx", shortName: "Pyra" },
            ])
        );
    });

    it("lists every group in event, round and group order", () => {
        expect(getGroupOptions(wcif)).toEqual([
            {
                id: "333-r1-g1",
                eventId: "333",
                label: "3x3x3 Cube · Round 1 · Group 1",
            },
            {
                id: "333-r1-g2",
                eventId: "333",
                label: "3x3x3 Cube · Round 1 · Group 2",
            },
            {
                id: "pyram-r1-g1",
                eventId: "pyram",
                label: "Pyraminx · Round 1 · Group 1",
            },
        ]);
    });

    it("allows one group per event in a room", () => {
        expect(canAddGroup(["333-r1-g1"], "pyram-r1-g1")).toBe(true);
        expect(canAddGroup(["333-r1-g1"], "333-r1-g2")).toBe(false);
    });

    it("lists official rounds that a change starts, once each", () => {
        expect(
            getStartedRounds(
                [{ currentGroupIds: ["222-r1-g1"] }, { currentGroupIds: [] }],
                [
                    { currentGroupIds: ["333-r1-g1", "fto-r1-g1"] },
                    { currentGroupIds: ["333-r1-g2", "222-r1-g2"] },
                ],
                (eventId) => eventId === "fto"
            )
        ).toEqual(["333-r1"]);
    });

    it("labels groups and rounds briefly", () => {
        expect(shortGroupLabel("333-r1-g2")).toBe("3x3 R1 G2");
        expect(roundLabel("333-r1-g2")).toBe("3x3x3 Cube · Round 1");
    });
});
