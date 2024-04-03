import { getToken } from "./auth";

const DEV_BACKEND_URL = import.meta.env.VITE_BACKEND_ORIGIN
    ? import.meta.env.VITE_BACKEND_ORIGIN
    : "http://localhost:5000";
const DEV_WCA_URL =
    import.meta.env.VITE_WCA_ORIGIN || "https://www.worldcubeassociation.org";

export const WCA_ORIGIN = import.meta.env.PROD
    ? "https://www.worldcubeassociation.org"
    : DEV_WCA_URL;

const BACKEND_URL = import.meta.env.PROD ? "/api" : DEV_BACKEND_URL;

export const INCIDENTS_WEBSOCKET_URL = import.meta.env.PROD
    ? "/incidents"
    : `${DEV_BACKEND_URL}/incidents`;
export const DEVICES_WEBSOCKET_URL = import.meta.env.PROD
    ? "/device"
    : `${DEV_BACKEND_URL}/device`;
export const RESULTS_WEBSOCKET_URL = import.meta.env.PROD
    ? "/result"
    : `${DEV_BACKEND_URL}/result`;
export const COMPETITION_WEBSOCKET_URL = import.meta.env.PROD
    ? "/competition"
    : `${DEV_BACKEND_URL}/competition`;
export const ATTENDANCE_WEBSOCKET_URL = import.meta.env.PROD
    ? "/attendance"
    : `${DEV_BACKEND_URL}/attendance`;

export const WEBSOCKET_PATH = import.meta.env.PROD ? "/api/socket.io/" : "";

export const backendRequest = (
    path: string,
    method: string,
    useAuth: boolean,
    body?: unknown
) => {
    const token = getToken();
    const headers = new Headers();
    headers.append("Content-Type", "application/json");
    if (token && useAuth) {
        headers.append("Authorization", `Bearer ${token}`);
    }
    return fetch(`${BACKEND_URL}/${path}`, {
        method: method,
        headers: headers,
        redirect: "follow",
        body: JSON.stringify(body),
    });
};

export const wcaApiRequest = (path: string) => {
    return fetch(`${WCA_ORIGIN}/api/v0/${path}`);
};
