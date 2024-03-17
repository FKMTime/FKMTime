import { Competition } from "@wca/helpers";
import { backendRequest } from "./request";
import { getLimitByRoundId } from "./utils";

export const getResultsByRoundId = async (
    roundId: string,
    search?: string,
    groupId?: string
) => {
    let route = `result/round/${roundId}`;
    const params = [];
    if (search && search.length > 0) {
        params.push(`search=${search}`);
    }
    if (groupId) {
        params.push(`groupId=${groupId}`);
    }
    const paramsString = params.join("&");
    if (paramsString.length > 0) {
        route += `?${paramsString}`;
    }
    const response = await backendRequest(route, "GET", true);
    return await response.json();
};

export const getAllResultsByPersonId = async (id: string) => {
    const response = await backendRequest(`result/person/${id}`, "GET", true);
    return await response.json();
};

export const getResultById = async (id: string) => {
    const response = await backendRequest(`result/${id}`, "GET", true);
    return {
        data: await response.json(),
        status: response.status,
    };
};

export const reSubmitScorecardToWcaLive = async (id: string) => {
    const response = await backendRequest(`result/${id}/enter`, "GET", true);
    return response.status;
};

export const reSubmitRoundToWcaLive = async (roundId: string) => {
    const response = await backendRequest(
        `result/round/${roundId}/enter`,
        "POST",
        true
    );
    return response.status;
};

export const checkTimeLimit = (
    time: number,
    wcif: Competition,
    roundId: string
) => {
    const timeLimit = getLimitByRoundId(roundId, wcif);
    if (!timeLimit) {
        return true;
    }
    if (time > timeLimit.centiseconds) {
        return false;
    }
    return true;
};
