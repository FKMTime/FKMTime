import { getToken } from "./auth";

const DEV_BACKEND_URL = import.meta.env.VITE_BACKEND_ORIGIN
    ? import.meta.env.VITE_BACKEND_ORIGIN
    : "http://localhost:5000";
const DEV_WCA_URL =
    import.meta.env.VITE_WCA_ORIGIN ||
    "https://staging.worldcubeassociation.org";

export const WCA_ORIGIN = import.meta.env.PROD
    ? "https://www.worldcubeassociation.org"
    : DEV_WCA_URL;

const PRODUCTION_WCA_CLIENT_ID = import.meta.env.VITE_WCA_CLIENT_ID
    ? import.meta.env.VITE_WCA_CLIENT_ID
    : "ZODPEQQjPyCnAO-GAXtaHjN7iQyosQfSzPMZG6RcVJ0";

export const WCA_CLIENT_ID = import.meta.env.PROD
    ? PRODUCTION_WCA_CLIENT_ID
    : "example-application-id";

const BACKEND_URL = import.meta.env.PROD ? "/api" : DEV_BACKEND_URL;

export const WEBSOCKET_PATH = import.meta.env.PROD ? "/api/socket.io/" : "";
export const WEBSOCKET_URL = import.meta.env.PROD ? "/" : `${DEV_BACKEND_URL}/`;

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

export const wcaApiRequest = (path: string, token?: string) => {
    const headers = new Headers();
    headers.append("Content-Type", "application/json");
    if (token) {
        headers.append("Authorization", `Bearer ${token}`);
    }
    return fetch(`${WCA_ORIGIN}/api/v0/${path}`, {
        method: "GET",
        headers: headers,
        redirect: "follow",
    });
};
