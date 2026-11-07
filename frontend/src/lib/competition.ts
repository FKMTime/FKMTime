import { getUserInfo } from "@/lib/auth";
import { getScramblingDeviceToken } from "@/lib/scramblingDevicesAuth";

import { Activity, Competition, Room, WCACompetition } from "./interfaces";
import { Query, queryFamily } from "./queryCache";
import {
    backendQuery,
    backendRequest,
    scramblingDeviceBackendRequest,
    wcaApiRequest,
} from "./request";

export const getCompetitionInfo = async () => {
    const isScramblignDeviceToken = getScramblingDeviceToken() !== null;
    let response: Response;
    if (isScramblignDeviceToken) {
        response = await scramblingDeviceBackendRequest(
            "competition/for/scrambling-device",
            "GET"
        );
    } else {
        response = await backendRequest("competition", "GET", true);
    }
    const data = await response.json();
    return {
        status: response.status,
        data,
    };
};

export const competitionSettingsQuery = backendQuery<Competition>(
    "competition/settings"
);

export const importCompetition = async (id: string) => {
    const response = await backendRequest(
        `competition/import/${id}`,
        "GET",
        true
    );
    const data = await response.json();
    return {
        status: response.status,
        data,
    };
};

export const syncCompetition = async (id: string) => {
    const response = await backendRequest(
        `competition/sync/${id}`,
        "GET",
        true
    );
    return response.status;
};

export const updateCompetitionSettings = async (
    id: string,
    data: Competition
) => {
    const competition = {
        ...data,
        wcif: undefined,
    };
    const response = await backendRequest(
        `competition/settings/${id}`,
        "PUT",
        true,
        competition
    );
    return response.status;
};

export const getDevicesSettings = async () => {
    const response = await backendRequest(
        "competition/settings/devices",
        "GET",
        true
    );
    return await response.json();
};

export const updateDevicesSettings = async (id: string, data: Competition) => {
    // The WCIF is large and these settings don't touch it
    const response = await backendRequest(
        `competition/settings/${id}/devices/`,
        "PUT",
        true,
        { ...data, wcif: undefined }
    );
    return response.status;
};

export const generateApiToken = async () => {
    const response = await backendRequest(
        "competition/settings/token",
        "GET",
        true
    );
    return await response.json();
};

export const getUpcomingManageableCompetitions = async (): Promise<
    WCACompetition[]
> => {
    const userInfo = getUserInfo();
    if (!userInfo) {
        return [];
    }
    const token = userInfo.wcaAccessToken;
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const params = `managed_by_me=true&start=${oneWeekAgo.toISOString()}&sort=start_date`;
    const response = await wcaApiRequest(`competitions?${params}`, token);
    return await response.json();
};

export const searchCompetitions = async (name: string) => {
    const userInfo = getUserInfo();
    if (!userInfo) {
        return [];
    }
    const token = userInfo.wcaAccessToken;
    try {
        const today = new Date();
        let start = "";
        if (name.length < 1) {
            start = `${today.getFullYear()}-${(today.getMonth() + 1)
                .toString()
                .padStart(
                    2,
                    "0"
                )}-${today.getDate().toString().padStart(2, "0")}`;
        }
        const response = await wcaApiRequest(
            `competitions?q=${encodeURIComponent(name)}&start=${start}&per_page=50&sort=start_date`,
            token
        );
        const data = await response.json();
        return data.filter(
            (competition: WCACompetition) =>
                new Date(competition.start_date).getFullYear() >= 2023
        );
    } catch {
        return [];
    }
};

export const getCompetitionStatistics = async () => {
    const response = await backendRequest(
        `competition/statistics/`,
        "GET",
        true
    );
    return await response.json();
};

export const getAvailableLocales = async () => {
    const response = await backendRequest(
        `competition/available-locales/`,
        "GET",
        true
    );
    return await response.json();
};

export const getInfoForLoginPage = async () => {
    const response = await backendRequest(
        `competition/login-info/`,
        "GET",
        false
    );
    return await response.json();
};

export const getPublicCompetitionInfo = async () => {
    const response = await backendRequest("competition/public", "GET", false);
    const data = await response.json();
    return { status: response.status, data };
};

/** The rooms and their current groups, without signing in */
export const publicRoomsQuery = backendQuery<Room[]>(
    "competition/public/rooms",
    { useAuth: false }
);

export const getPublicRooms = async () => {
    const response = await backendRequest(
        "competition/public/rooms",
        "GET",
        false
    );
    return await response.json();
};

/** A room's activities on a day, with real times from device attempts */
export const getRoomActivities = async (
    venueId: number,
    roomId: number,
    date: Date
): Promise<Activity[]> => {
    const response = await backendRequest(
        `competition/activities?venueId=${venueId}&roomId=${roomId}&date=${date.toISOString()}`,
        "GET",
        true
    );
    if (!response.ok) throw new Error("Could not load the schedule");
    return await response.json();
};

const roomActivitiesQueries = new Map<string, Query<Activity[]>>();

/** A room's schedule for one day; one stable query per room and day */
export const roomActivitiesQuery = (
    venueId: number,
    roomId: number,
    date: Date
) => {
    const key = `competition/activities?venueId=${venueId}&roomId=${roomId}&date=${date.toISOString()}`;
    const query = roomActivitiesQueries.get(key) ?? {
        key,
        fetch: () => getRoomActivities(venueId, roomId, date),
    };
    roomActivitiesQueries.set(key, query);
    return query;
};

const groupIdsQuery = (groupIds?: string[]) =>
    groupIds ? `?groupIds=${groupIds.join(",")}` : "";

/** The next groups in a room's schedule, from its saved current groups */
export const nextGroupsQuery = queryFamily((roomId) =>
    backendQuery<string[]>(`competition/rooms/${roomId}/next-groups`)
);

/** Steps from the given groups, or the room's saved ones without them */
export const getNextGroupsFromScheduleForRoom = async (
    roomId: string,
    groupIds?: string[]
) => {
    const response = await backendRequest(
        `competition/rooms/${roomId}/next-groups${groupIdsQuery(groupIds)}`,
        "GET",
        true
    );
    return await response.json();
};

/** Steps from the given groups, or the room's saved ones without them */
export const getPreviousGroupsFromScheduleForRoom = async (
    roomId: string,
    groupIds?: string[]
) => {
    const response = await backendRequest(
        `competition/rooms/${roomId}/previous-groups${groupIdsQuery(groupIds)}`,
        "GET",
        true
    );
    return await response.json();
};
