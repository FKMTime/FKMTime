import { beforeEach, describe, expect, it } from "vitest";
import { Competition } from "wcif-helpers";

import { Room } from "@/lib/interfaces";
import { getRoundOptions, getStripRounds } from "@/lib/roundOptions";

const wcif = {
    events: [
        { id: "333", rounds: [{ id: "333-r1" }, { id: "333-r2" }] },
        { id: "pyram", rounds: [{ id: "pyram-r1" }] },
    ],
} as unknown as Competition;

const rooms = [
    { id: "1", name: "Main room", currentGroupIds: ["333-r1-g2"], color: "" },
    { id: "2", name: "Side room", currentGroupIds: ["333-r1-g3"], color: "" },
] as Room[];

describe("getRoundOptions", () => {
    beforeEach(() => {
        localStorage.setItem(
            "fkmtime-events",
            JSON.stringify([
                { id: "333", name: "3x3x3 Cube", shortName: "3x3" },
                { id: "pyram", name: "Pyraminx", shortName: "Pyra" },
            ])
        );
    });

    it("lists every round with names and the rooms running it", () => {
        const options = getRoundOptions(wcif, rooms);
        expect(options.map((o) => o.id)).toEqual([
            "333-r1",
            "333-r2",
            "pyram-r1",
        ]);
        expect(options[0]).toMatchObject({
            label: "3x3 R1",
            name: "3x3x3 Cube · Round 1",
            eventName: "3x3x3 Cube",
            liveRooms: ["Main room", "Side room"],
            isLive: true,
        });
        expect(options[1].isLive).toBe(false);
    });

    it("does not treat round 1 groups as round 10", () => {
        const options = getRoundOptions(
            {
                events: [{ id: "333", rounds: [{ id: "333-r10" }] }],
            } as unknown as Competition,
            rooms
        );
        expect(options[0].isLive).toBe(false);
    });
});

describe("getStripRounds", () => {
    it("keeps live rounds and the selected one", () => {
        const options = getRoundOptions(wcif, rooms);
        expect(getStripRounds(options, "pyram-r1").map((o) => o.id)).toEqual([
            "333-r1",
            "pyram-r1",
        ]);
        expect(getStripRounds(options).map((o) => o.id)).toEqual(["333-r1"]);
    });
});
