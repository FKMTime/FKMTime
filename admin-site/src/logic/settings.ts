import { Settings } from "./interfaces";
import { backendRequest } from "./request";

export const getSettings = async () => {
    const response = await backendRequest(`settings`, "GET", true);
    return await response.json();
};

export const updateSettings = async (data: Settings) => {
    const response = await backendRequest(`settings`, "PUT", true, data);
    return response.status;
};

export const changePassword = async (oldPassword: string, newPassword: string) => {
    const response = await backendRequest(`auth/password/change`, "PUT", true, {oldPassword, newPassword});
    return response.status;
};