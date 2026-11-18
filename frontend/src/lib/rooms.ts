import { Room } from "./interfaces";
import { backendQuery, backendRequest } from "./request";

export const getAllRooms = async () => {
    const response = await backendRequest("competition/rooms", "GET", true);
    return await response.json();
};

export const roomsQuery = backendQuery<Room[]>("competition/rooms");

/** Each room's group progress, for the home page */
export const roomsProgressQuery = backendQuery<RoomProgress[]>(
    "competition/rooms/progress"
);

export const updateCurrentRound = async (rooms: Room[]) => {
    const response = await backendRequest("competition/rooms", "PUT", true, {
        rooms,
    });
    return {
        status: response.status,
        data: await response.json(),
    };
};

/**
 * Saves one room's groups and nothing else, so a page holding older data
 * for the other rooms can't undo what changed there meanwhile (e.g. an
 * automatic group change).
 */
export const updateRoomGroups = (room: Room, currentGroupIds: string[]) =>
    updateCurrentRound([{ ...room, currentGroupIds }]);

export interface GroupProgress {
    groupId: string;
    roundId: string;
    competitors: number;
    /** Competitors whose result is complete */
    finished: number;
    entered: number;
    expected: number;
    /** Every competitor is past the cutoff, so expected can't change */
    expectedIsFinal: boolean;
}

/** Every attempt the group's competitors will do is in */
export const isGroupDone = (progress?: GroupProgress) =>
    !!progress &&
    progress.expected > 0 &&
    progress.entered >= progress.expected;

export interface RoomProgress {
    roomId: string;
    groups: GroupProgress[];
}

/** Results entered vs expected for each room's current groups */
export const getRoomsProgress = async (): Promise<RoomProgress[]> => {
    const response = await backendRequest(
        "competition/rooms/progress",
        "GET",
        true
    );
    return await response.json();
};
