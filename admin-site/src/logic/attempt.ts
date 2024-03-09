import { Attempt } from "./interfaces";
import { backendRequest } from "./request";

interface UpdateAttemptData extends Attempt {
    shouldResubmitToWcaLive: boolean;
}

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
