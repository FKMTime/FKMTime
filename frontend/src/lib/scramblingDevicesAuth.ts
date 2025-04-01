import { logout } from "./auth";
import { backendRequest } from "./request";

const SCRAMBLING_DEVICE_TOKEN_NAME = "fkmtime-scrambling-device-token";
const SCRAMBLING_DEVICE_INFO_NAME = "fkmtime-scrambling-device-info";

export const getScramblingDeviceTokenFromCode = async (code: string) => {
    const response = await backendRequest(
        `scrambling-device/token`,
        "POST",
        false,
        { code }
    );
    const data = await response.json();
    if (response.status === 201) {
        logout();
        localStorage.setItem(SCRAMBLING_DEVICE_TOKEN_NAME, data.token);
        localStorage.setItem(
            SCRAMBLING_DEVICE_INFO_NAME,
            JSON.stringify(data.device)
        );
    }
    return response.status;
};

export const getScramblingDeviceToken = () => {
    return localStorage.getItem(SCRAMBLING_DEVICE_TOKEN_NAME);
};

export const logoutScramblingDevice = () => {
    localStorage.removeItem(SCRAMBLING_DEVICE_TOKEN_NAME);
    localStorage.removeItem(SCRAMBLING_DEVICE_INFO_NAME);
};

export const getScramblingDeviceInfo = () => {
    const scramblingDeviceInfo = localStorage.getItem(
        SCRAMBLING_DEVICE_INFO_NAME
    );
    if (scramblingDeviceInfo === null) {
        return null;
    }
    return JSON.parse(scramblingDeviceInfo);
};

export const isScrambleDeviceTokenValid = async () => {
    try {
        const response = await backendRequest(
            "scrambling-device/token-valid",
            "POST",
            false,
            {
                token: getScramblingDeviceToken(),
            }
        );
        return response.status === 200;
    } catch (error) {
        return false;
    }
};
