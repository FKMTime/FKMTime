import { backendRequest } from "./request";

export const getScrambleSets = async (roundId: string) => {
    const response = await backendRequest(
        `scramble-set/${roundId}`,
        "GET",
        true
    );
    return await response.json();
};

export const deleteScrambleSet = async (id: string) => {
    const response = await backendRequest(`scramble-set/${id}`, "DELETE", true);
    return response.status;
};

export const deleteScrambleSetsByRoundId = async (roundId: string) => {
    const response = await backendRequest(
        `scramble-set/round/${roundId}`,
        "DELETE",
        true
    );
    return response.status;
};

export const deleteAllScrambleSets = async () => {
    const response = await backendRequest(`scramble-set/all`, "DELETE", true);
    return response.status;
};
