import { Attempt, AttemptStatus, Incident } from "./interfaces";
import { backendRequest } from "./request";

interface UpdateAttemptData extends Attempt {
    submitToWcaLive: boolean;
    updateReplacedBy?: boolean;
}

interface CreateAttemptData {
    roundId: string;
    deviceId: string;
    competitorId: string;
    judgeId: string;
    attemptNumber: number;
    value: number;
    penalty: number;
    comment: string;
    replacedBy: number;
    submitToWcaLive: boolean;
    status: AttemptStatus;
}

export const createAttempt = async (data: CreateAttemptData) => {
    const response = await backendRequest("attempt", "POST", true, data);
    return response.status;
};

export const getUnresolvedAttempts = async (): Promise<Incident[]> => {
    const response = await backendRequest("attempt/unresolved", "GET", true);
    return await response.json();
};

export const getResolvedIncidents = async (
    search?: string
): Promise<Incident[]> => {
    const url = search
        ? `attempt/incidents?search=${search}`
        : "attempt/incidents";
    const response = await backendRequest(url, "GET", true);
    return await response.json();
};

export const getIncidentById = async (id: string): Promise<Incident> => {
    const response = await backendRequest(`attempt/${id}`, "GET", true);
    return await response.json();
};

export const swapAttempts = async (
    firstAttemptId: string,
    secondAttemptId: string
) => {
    const response = await backendRequest("attempt/swap", "PUT", true, {
        firstAttemptId,
        secondAttemptId,
    });
    return response.status;
};

export const updateAttempt = async (data: UpdateAttemptData) => {
    const response = await backendRequest(
        `attempt/${data.id}`,
        "PUT",
        true,
        data
    );
    return response.status;
};

export const deleteAttempt = async (id: string) => {
    const response = await backendRequest(`attempt/${id}`, "DELETE", true);
    return {
        status: response.status,
        data: await response.json(),
    };
};
