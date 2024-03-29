import { Competition, WCACompetition } from "./interfaces";
import { backendRequest, wcaApiRequest } from "./request";

export const getCompetitionInfo = async () => {
    const response = await backendRequest("competition", "GET", true);
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

export const updateDevicesSettings = async (
    id: string,
    data: {
        shouldUpdateDevices: boolean;
        releaseChannel: string;
        wifiSsid?: string;
        wifiPassword?: string;
    }
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

export const searchCompetitions = async (name: string) => {
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
            `competitions?q=${name}&start=${start}&per_page=50&sort=start_date`
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
