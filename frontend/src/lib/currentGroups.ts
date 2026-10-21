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

/** Why a room cannot run these groups together, or null if it can */
export const getRoomGroupsError = (groupIds: string[]): string | null => {
    const eventIds = groupIds.map(getEventId);
    if (new Set(eventIds).size !== eventIds.length)
        return "You cannot have 2 or more groups in the room for the same event";
    return null;
};

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
const shortGroupLabel = (groupId: string) =>
    activityCodeToName(groupId, true, true, true).replace(/, /g, " ");

/**
 * One line per room whose groups would change on save, e.g.
 * "Main Hall: 3x3 R1 G2 → 3x3 R1 G3".
 */
export const describeGroupChanges = (
    saved: { id: string; name: string; currentGroupIds: string[] }[],
    draft: { id: string; name: string; currentGroupIds: string[] }[]
): string[] =>
    draft.flatMap((room) => {
        const before =
            saved.find((r) => r.id === room.id)?.currentGroupIds ?? [];
        const after = room.currentGroupIds;
        if (
            before.length === after.length &&
            before.every((id) => after.includes(id))
        )
            return [];
        const label = (ids: string[]) =>
            ids.length ? ids.map(shortGroupLabel).join(", ") : "no group";
        return [`${room.name}: ${label(before)} → ${label(after)}`];
    });
