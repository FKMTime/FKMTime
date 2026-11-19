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

/** What a running group waits for before the room can move on */
export interface GroupWait {
    state: "notStarted" | "inProgress" | "waitingForCompetitors" | "finished";
    /** Assigned or present, not started, and not marked as not coming */
    notStarted: {
        /** Null when there's no attendance row to mark them on */
        personId: string | null;
        name: string;
    }[];
    /** Competitors with attempts still to do */
    solving: number;
    /** Competitors with an incident to resolve */
    incidents: number;
    /** Competitors with an extra attempt still to do */
    extras: number;
    /** When the room moves on by itself if nobody else solves */
    movesOnAt: string | null;
}

export interface GroupProgress {
    groupId: string;
    roundId: string;
    competitors: number;
    entered: number;
    expected: number;
    wait?: GroupWait;
}

/**
 * Nothing left for the group: what the automatic group change goes by, or
 * without it every attempt in
 */
export const isGroupDone = (progress?: GroupProgress) =>
    !!progress &&
    (progress.wait
        ? progress.wait.state === "finished"
        : progress.expected > 0 && progress.entered >= progress.expected);

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
