import { Attempt } from "./interfaces";
import { backendRequest } from "./request"

export const updateAttempt = async (data: Attempt) => {
    const response = await backendRequest(`attempt/${data.id}`, "PUT", true, data);
    return response.status;
};

export const deleteAttempt = async (id: number) => {
    const response = await backendRequest(`attempt/${id}`, "DELETE", true);
    return response.status;
};