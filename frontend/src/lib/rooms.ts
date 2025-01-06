import { Room } from "./interfaces";
import { backendRequest } from "./request";

export const getAllRooms = async () => {
    const response = await backendRequest("competition/rooms", "GET", true);
    return await response.json();
};

export const updateCurrentRound = async (rooms: Room[]) => {
    const response = await backendRequest("competition/rooms", "PUT", true, {
        rooms,
    });
    return response.status;
};
