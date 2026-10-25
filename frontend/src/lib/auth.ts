import { backendRequest } from "./request";
import { logoutScramblingDevice } from "./scramblingDevicesAuth";

const TOKEN_NAME = "fkmtime-token";
const USER_INFO_NAME = "fkmtime-userInfo";

export const login = async (
    username: string,
    password: string
): Promise<{ status: number; message?: string }> => {
    const response = await backendRequest("auth/login", "POST", false, {
        username: username.trim(),
        password: password,
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 200) {
        logoutScramblingDevice();
        localStorage.setItem(TOKEN_NAME, data.token);
        localStorage.setItem(USER_INFO_NAME, JSON.stringify(data.userInfo));
    }
    return { status: response.status, message: data.message };
};

/** What to tell someone whose sign-in failed, from the backend's answer */
export const loginErrorMessage = (status: number, errorMessage?: string) => {
    if (status === 401) return "Wrong username or password";
    if (status === 429)
        return "Too many sign-in attempts. Wait a minute and try again.";
    return errorMessage || "Something went wrong";
};

export const loginWithWca = async (code: string, redirectUri: string) => {
    const response = await backendRequest("auth/wca/login", "POST", false, {
        code: code,
        redirectUri: redirectUri,
    });
    const data = await response.json();
    if (response.status === 200) {
        logoutScramblingDevice();
        localStorage.setItem(TOKEN_NAME, data.token);
        localStorage.setItem(USER_INFO_NAME, JSON.stringify(data.userInfo));
    }
    return {
        status: response.status,
        data: data,
    };
};

export const updateUserInfo = async () => {
    const me = await backendRequest("auth/me", "GET", true);
    const userInfo = await me.json();
    localStorage.setItem(USER_INFO_NAME, JSON.stringify(userInfo));
};

export const getToken = () => {
    return localStorage.getItem(TOKEN_NAME);
};

export const logout = () => {
    localStorage.removeItem(TOKEN_NAME);
    localStorage.removeItem(USER_INFO_NAME);
};

export const isUserLoggedIn = async () => {
    try {
        const response = await backendRequest("auth/me", "GET", true);
        return response.status === 200;
    } catch (error) {
        return false;
    }
};

export const getUserInfo = () => {
    const userInfo = localStorage.getItem(USER_INFO_NAME);
    if (userInfo === null) {
        return null;
    }
    return JSON.parse(userInfo);
};
