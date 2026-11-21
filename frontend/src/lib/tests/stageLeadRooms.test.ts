import { describe, expect, it } from "vitest";

import {
    initialStageLeadRooms,
    needsRoomChoice,
    showsRoomChoice,
    stageLeadRoomsLabel,
    stageLeadRoomsPayload,
} from "../stageLeadRooms";

const ROOMS = [
    { id: "main", name: "Main Hall" },
    { id: "side", name: "Side Hall" },
];
const lead = ["STAGE_LEADER"];
const nothing = { allRooms: false, roomIds: [] };

describe("stage lead rooms", () => {
    it("asks for rooms only for a stage lead with more than one room", () => {
        expect(showsRoomChoice(lead, 2)).toBe(true);
        expect(showsRoomChoice(lead, 1)).toBe(false);
        expect(showsRoomChoice(["STAGE_LEADER", "ORGANIZER"], 2)).toBe(false);
        expect(showsRoomChoice(["STAFF"], 2)).toBe(false);
    });

    it("waits for a room before saving", () => {
        expect(needsRoomChoice(lead, 2, nothing)).toBe(true);
        expect(needsRoomChoice(lead, 2, { allRooms: true, roomIds: [] })).toBe(
            false
        );
        expect(
            needsRoomChoice(lead, 2, { allRooms: false, roomIds: ["main"] })
        ).toBe(false);
        expect(needsRoomChoice(lead, 1, nothing)).toBe(false);
    });

    it("sends all rooms when there is one room to choose from", () => {
        expect(stageLeadRoomsPayload(lead, 1, nothing)).toEqual({
            stageLeadAllRooms: true,
        });
    });

    it("sends the ticked rooms, or all rooms", () => {
        expect(
            stageLeadRoomsPayload(lead, 2, {
                allRooms: false,
                roomIds: ["side"],
            })
        ).toEqual({ stageLeadRoomIds: ["side"] });
        expect(
            stageLeadRoomsPayload(lead, 2, { allRooms: true, roomIds: [] })
        ).toEqual({ stageLeadAllRooms: true });
    });

    it("sends nothing about rooms for anyone else", () => {
        expect(stageLeadRoomsPayload(["STAFF"], 2, nothing)).toEqual({});
    });

    it("opens an existing stage lead with no rooms as all rooms", () => {
        expect(initialStageLeadRooms({ roles: lead })).toEqual({
            allRooms: true,
            roomIds: [],
        });
        expect(
            initialStageLeadRooms({ roles: lead, stageLeadRoomIds: ["main"] })
        ).toEqual({ allRooms: false, roomIds: ["main"] });
        // Someone becoming a stage lead starts with nothing ticked
        expect(initialStageLeadRooms({ roles: ["STAFF"] })).toEqual(nothing);
    });

    it("names the rooms after the role", () => {
        expect(
            stageLeadRoomsLabel(
                { roles: lead, stageLeadRoomIds: ["side"] },
                ROOMS
            )
        ).toBe("Side Hall");
        expect(stageLeadRoomsLabel({ roles: lead }, ROOMS)).toBe("All rooms");
        expect(stageLeadRoomsLabel({ roles: lead }, ROOMS.slice(0, 1))).toBe(
            null
        );
    });
});
