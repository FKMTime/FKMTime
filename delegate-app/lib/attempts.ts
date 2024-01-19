import { backendRequest } from "./request"

export const getUnresolvedAttempts = async () => {
    const response = await backendRequest("attempt/unresolved", "GET", true);
    return await response.json();
};