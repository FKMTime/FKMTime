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

export interface GroupProgress {
    groupId: string;
    roundId: string;
    competitors: number;
    entered: number;
    expected: number;
}

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
