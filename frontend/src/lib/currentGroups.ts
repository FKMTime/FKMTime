import { Competition as WCIF } from "wcif-helpers";

import { activityCodeToName, getGroupsByRoundId } from "./activities";

export interface GroupOption {
    id: string;
    eventId: string;
    /** "3x3x3 Cube · Round 1 · Group 2" */
    label: string;
}

const getEventId = (groupId: string) => groupId.split("-r")[0];
const getRoundId = (groupId: string) => groupId.split("-g")[0];

export const getGroupLabel = (groupId: string) =>
    `${activityCodeToName(getRoundId(groupId)).replace(", ", " · ")} · Group ${groupId.split("-g")[1]}`;

/** Every group of every round, in event and round order */
export const getGroupOptions = (wcif: WCIF): GroupOption[] =>
    wcif.events.flatMap((event) =>
        event.rounds.flatMap((round) =>
            getGroupsByRoundId(round.id, wcif).map((group) => ({
                id: group.activityCode,
                eventId: event.id,
                label: getGroupLabel(group.activityCode),
            }))
        )
    );

/** A group can be added unless the room already runs its event */
export const canAddGroup = (groupIds: string[], groupId: string) =>
    !groupIds.includes(groupId) &&
    !groupIds.some((id) => getEventId(id) === getEventId(groupId));

/** Official rounds in progress anywhere, to open in WCA Live */
export const getRoundsToOpen = (
    rooms: { currentGroupIds: string[] }[],
    isUnofficial: (eventId: string) => boolean | undefined
) => [
    ...new Set(
        rooms
            .flatMap((room) => room.currentGroupIds.map(getRoundId))
            .filter((roundId) => !isUnofficial(getEventId(roundId)))
    ),
];

/** "3x3 R1 G2" */
export const shortGroupLabel = (groupId: string) =>
    activityCodeToName(groupId, true, true, true).replace(/, /g, " ");

/** "3x3x3 Cube · Round 1" */
export const roundLabel = (groupId: string) =>
    activityCodeToName(getRoundId(groupId)).replace(", ", " · ");
