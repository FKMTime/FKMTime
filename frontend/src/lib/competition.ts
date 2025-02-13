import { getUserInfo } from "@/lib/auth";
import { getScramblingDeviceToken } from "@/lib/scramblingDevicesAuth";

import { Competition, WCACompetition } from "./interfaces";
import {
    backendRequest,
    scramblingDeviceBackendRequest,
    wcaApiRequest,
} from "./request";

export const getCompetitionInfo = async () => {
    const isScramblignDeviceToken = getScramblingDeviceToken() !== null;
    let response: Response | null = null;
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

export const getCompetitionSettings = async () => {
    const response = await backendRequest("competition/settings", "GET", true);
    const data = await response.json();
    return {
        status: response.status,
        data,
    };
};

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

export const getActivitiesWithRealEndTime = async (
    venueId: number,
    roomId: number,
    date: Date
) => {
    const response = await backendRequest(
        `competition/activities?venueId=${venueId}&roomId=${roomId}&date=${date.toISOString()}`,
        "GET",
        true
    );
    return await response.json();
};

type CompetitionWithoutWCIF = Omit<Competition, "wcif">;

export const updateDevicesSettings = async (
    id: string,
    data: CompetitionWithoutWCIF
) => {
    const response = await backendRequest(
        `competition/settings/${id}/devices/`,
        "PUT",
        true,
        data
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
            `competitions?q=${name}&start=${start}&per_page=50&sort=start_date`,
            token
        );
        const data = await response.json();
        return data.filter(
            (competition: WCACompetition) =>
                new Date(competition.start_date).getFullYear() >= 2023
        );
    } catch (err) {
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
