import { UserRole } from "./interfaces";

/** The rooms a stage lead takes attendance in, as the user dialogs hold them */
export interface StageLeadRoomsValue {
    allRooms: boolean;
    roomIds: string[];
}

/** What the create and edit user requests send about rooms (SPEC-016) */
export interface StageLeadRoomsPayload {
    stageLeadAllRooms?: boolean;
    stageLeadRoomIds?: string[];
}

const FULL_ACCESS_ROLES: string[] = [
    UserRole.ADMIN,
    UserRole.ORGANIZER,
    UserRole.DELEGATE,
];

/** A stage lead whose rooms matter: organizers and above have every room */
export const isScopedStageLead = (roles: string[]) =>
    roles.includes(UserRole.STAGE_LEADER) &&
    !roles.some((role) => FULL_ACCESS_ROLES.includes(role));

/** With one room there is nothing to choose */
export const showsRoomChoice = (roles: string[], roomCount: number) =>
    isScopedStageLead(roles) && roomCount > 1;

/**
 * What the dialog starts with: an existing stage lead's rooms, where none
 * means all rooms; nothing ticked for anyone else
 */
export const initialStageLeadRooms = (user?: {
    roles: string[];
    stageLeadRoomIds?: string[];
}): StageLeadRoomsValue => {
    if (!user || !isScopedStageLead(user.roles))
        return { allRooms: false, roomIds: [] };
    const roomIds = user.stageLeadRoomIds ?? [];
    return { allRooms: roomIds.length === 0, roomIds };
};

/** Whether saving has to wait for a room to be ticked */
export const needsRoomChoice = (
    roles: string[],
    roomCount: number,
    value: StageLeadRoomsValue
) =>
    showsRoomChoice(roles, roomCount) &&
    !value.allRooms &&
    value.roomIds.length === 0;

export const stageLeadRoomsPayload = (
    roles: string[],
    roomCount: number,
    value: StageLeadRoomsValue
): StageLeadRoomsPayload => {
    if (!isScopedStageLead(roles)) return {};
    if (!showsRoomChoice(roles, roomCount) || value.allRooms)
        return { stageLeadAllRooms: true };
    return { stageLeadRoomIds: value.roomIds };
};

/**
 * "Main Hall", "Main Hall, Side Hall" or "All rooms" after "Stage leader" in
 * the users list; nothing with one room or for organizers and above
 */
export const stageLeadRoomsLabel = (
    user: { roles: string[]; stageLeadRoomIds?: string[] },
    rooms: { id: string; name: string }[]
) => {
    if (!showsRoomChoice(user.roles, rooms.length)) return null;
    const ids = user.stageLeadRoomIds ?? [];
    if (ids.length === 0) return "All rooms";
    return rooms
        .filter((room) => ids.includes(room.id))
        .map((room) => room.name)
        .join(", ");
};
