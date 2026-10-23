import { beforeEach, describe, expect, it } from "vitest";
import { Competition } from "wcif-helpers";

import {
    canAddGroup,
    describeGroupChanges,
    getGroupOptions,
    getRoomGroupsError,
    getRoundsToOpen,
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
        expect(getRoomGroupsError(["333-r1-g1", "pyram-r1-g1"])).toBeNull();
        expect(getRoomGroupsError(["333-r1-g1", "333-r2-g1"])).toBe(
            "You cannot have 2 or more groups in the room for the same event"
        );
        expect(canAddGroup(["333-r1-g1"], "pyram-r1-g1")).toBe(true);
        expect(canAddGroup(["333-r1-g1"], "333-r1-g2")).toBe(false);
    });

    it("lists official rounds in progress once, skipping unofficial ones", () => {
        expect(
            getRoundsToOpen(
                [
                    { currentGroupIds: ["333-r1-g1", "fto-r1-g1"] },
                    { currentGroupIds: ["333-r1-g2"] },
                ],
                (eventId) => eventId === "fto"
            )
        ).toEqual(["333-r1"]);
    });

    it("describes what saving would change, room by room", () => {
        const room = (id: string, name: string, currentGroupIds: string[]) => ({
            id,
            name,
            currentGroupIds,
        });
        const saved = [
            room("r1", "Main Hall", ["333-r1-g2"]),
            room("r2", "Side Room", ["pyram-r1-g1"]),
            room("r3", "Annex", []),
        ];
        const draft = [
            room("r1", "Main Hall", ["333-r1-g3"]),
            room("r2", "Side Room", ["pyram-r1-g1"]),
            room("r3", "Annex", ["333-r1-g1"]),
        ];
        expect(describeGroupChanges(saved, draft)).toEqual([
            "Main Hall: 3x3 R1 G2 → 3x3 R1 G3",
            "Annex: no group → 3x3 R1 G1",
        ]);
        expect(describeGroupChanges(saved, saved)).toEqual([]);
    });
});
