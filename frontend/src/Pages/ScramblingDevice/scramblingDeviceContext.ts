import { useOutletContext } from "react-router-dom";

import { activityCodeToName } from "@/lib/activities";
import { ScramblingDeviceRoom } from "@/lib/interfaces";

export interface ScramblingDeviceOutletContext {
    /** The device's room, refetched on every navigation; null while loading */
    room: ScramblingDeviceRoom | null;
}

export const useScramblingDeviceRoom = () =>
    useOutletContext<ScramblingDeviceOutletContext>().room;

/** "333-r1-g2" → "333-r1" */
export const groupIdToRoundId = (groupId: string) => groupId.split("-g")[0];

/** The group of this round currently running in the room, if any */
export const currentGroupIdForRound = (
    room: ScramblingDeviceRoom | null,
    roundId: string
) =>
    room?.currentGroupIds.find(
        (groupId) => groupIdToRoundId(groupId) === roundId
    );

/** Stations of this room a delegate pointed at the round (SPEC-007) */
export const stationNamesForRound = (
    room: ScramblingDeviceRoom | null,
    roundId: string
) =>
    room?.stationRounds?.find((r) => r.roundId === roundId)?.stationNames ?? [];

/** Rounds this room's stations take: the room's own, then pointed stations' */
export const roundIdsRunningHere = (room: ScramblingDeviceRoom | null) => [
    ...new Set([
        ...(room?.currentGroupIds.map(groupIdToRoundId) ?? []),
        ...(room?.stationRounds?.map((r) => r.roundId) ?? []),
    ]),
];

/** "3x3x3 Cube · Round 1" */
export const roundName = (roundId: string) =>
    activityCodeToName(roundId).replace(", ", " · ");

/** "3x3x3 Cube · Round 1 · Set A" */
export const scrambleSetName = (set: { roundId: string; set: string }) =>
    `${roundName(set.roundId)} · Set ${set.set}`;
