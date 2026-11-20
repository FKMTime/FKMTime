import { setToken } from "./auth";
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
    // Changing the password ends every session, this one included; the
    // backend sends a fresh token for this one
    if (response.status === 200) {
        const data = await response.json().catch(() => ({}));
        if (data?.token) setToken(data.token);
    }
    return response.status;
};
