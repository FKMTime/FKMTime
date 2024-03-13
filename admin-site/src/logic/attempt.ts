import { Attempt } from "./interfaces";
import { backendRequest } from "./request";

interface UpdateAttemptData extends Attempt {
    shouldResubmitToWcaLive: boolean;
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
    isExtraAttempt: boolean;
    isResolved: boolean;
    replacedBy: number;
    submitToWcaLive: boolean;
}

export const createAttempt = async (data: CreateAttemptData) => {
    const response = await backendRequest("attempt", "POST", true, data);
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
    return response.status;
};
