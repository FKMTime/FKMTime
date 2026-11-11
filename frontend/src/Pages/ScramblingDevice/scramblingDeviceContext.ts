import { useOutletContext } from "react-router-dom";

import { activityCodeToName } from "@/lib/activities";
import { Room } from "@/lib/interfaces";

export interface ScramblingDeviceOutletContext {
    /** The device's room, refetched on every navigation; null while loading */
    room: Room | null;
}

export const useScramblingDeviceRoom = () =>
    useOutletContext<ScramblingDeviceOutletContext>().room;

/** "333-r1-g2" → "333-r1" */
export const groupIdToRoundId = (groupId: string) => groupId.split("-g")[0];

/** The group of this round currently running in the room, if any */
export const currentGroupIdForRound = (room: Room | null, roundId: string) =>
    room?.currentGroupIds.find(
        (groupId) => groupIdToRoundId(groupId) === roundId
    );

/** "3x3x3 Cube · Round 1" */
export const roundName = (roundId: string) =>
    activityCodeToName(roundId).replace(", ", " · ");

/** "3x3x3 Cube · Round 1 · Set A" */
export const scrambleSetName = (set: { roundId: string; set: string }) =>
    `${roundName(set.roundId)} · Set ${set.set}`;
