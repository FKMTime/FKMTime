import { describe, expect, it } from "vitest";
import { Competition } from "wcif-helpers";

import { Room } from "@/lib/interfaces";
import { getLiveRoundIds, getRoundsInScheduleOrder } from "@/lib/roundOptions";

describe("getLiveRoundIds", () => {
    it("lists each round with a current group once", () => {
        const rooms = [
            { id: "1", name: "Main", currentGroupIds: ["333-r1-g2"] },
            {
                id: "2",
                name: "Side",
                currentGroupIds: ["333-r1-g3", "pyram-r10-g1"],
            },
            { id: "3", name: "Empty", currentGroupIds: [] },
        ] as unknown as Room[];
        expect(getLiveRoundIds(rooms)).toEqual(["333-r1", "pyram-r10"]);
    });
});

describe("getRoundsInScheduleOrder", () => {
    it("orders rounds by their earliest start, unscheduled ones last", () => {
        const activity = (activityCode: string, startTime: string) => ({
            activityCode,
            startTime,
        });
        const wcif = {
            events: [
                { id: "333", rounds: [{ id: "333-r1" }, { id: "333-r2" }] },
                { id: "222", rounds: [{ id: "222-r1" }, { id: "222-r2" }] },
            ],
            schedule: {
                venues: [
                    {
                        rooms: [
                            {
                                activities: [
                                    activity("333-r1", "2026-05-01T09:00:00Z"),
                                    activity("333-r2", "2026-05-01T14:00:00Z"),
                                ],
                            },
                            {
                                activities: [
                                    activity("222-r1", "2026-05-01T11:00:00Z"),
                                    activity("333-r1", "2026-05-01T08:00:00Z"),
                                ],
                            },
                        ],
                    },
                ],
            },
        } as unknown as Competition;
        expect(getRoundsInScheduleOrder(wcif)).toEqual([
            "333-r1",
            "222-r1",
            "333-r2",
            "222-r2",
        ]);
    });
});
