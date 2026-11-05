import { Settings } from "./interfaces";
import { backendQuery, backendRequest } from "./request";

export const settingsQuery = backendQuery<Settings>("settings");

export const updateSettings = async (data: Settings) => {
    const response = await backendRequest(`settings`, "PUT", true, data);
    return response.status;
};

export const changePassword = async (
    oldPassword: string,
    newPassword: string
) => {
    const response = await backendRequest(`auth/password/change`, "PUT", true, {
        oldPassword,
        newPassword,
    });
    return response.status;
};
