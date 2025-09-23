import { getToken } from "./auth";
import { getScramblingDeviceToken } from "./scramblingDevicesAuth";

// this will be changed inside docker env
const dockerBackendOrigin = "{{BACKEND_ORIGIN}}";
const dockerWcaOrigin = "{{WCA_ORIGIN}}";
const dockerWcaClientId = "{{WCA_CLIENT_ID}}";

export const WCA_ORIGIN = import.meta.env.VITE_DOCKERBUILD
    ? dockerWcaOrigin || "https://www.worldcubeassociation.org"
    : import.meta.env.PROD
      ? "https://www.worldcubeassociation.org"
      : import.meta.env.VITE_WCA_ORIGIN ||
        "https://staging.worldcubeassociation.org";

export const WCA_CLIENT_ID = import.meta.env.VITE_DOCKERBUILD
    ? dockerWcaClientId || "example-application-id"
    : import.meta.env.PROD
      ? import.meta.env.VITE_WCA_CLIENT_ID ||
        "ZODPEQQjPyCnAO-GAXtaHjN7iQyosQfSzPMZG6RcVJ0"
      : "example-application-id";

export const BACKEND_ORIGIN = import.meta.env.VITE_DOCKERBUILD
    ? dockerBackendOrigin || "/api"
    : import.meta.env.PROD
      ? "/api"
      : import.meta.env.VITE_BACKEND_ORIGIN || "http://localhost:5000";

export const WEBSOCKET_PATH = import.meta.env.PROD ? "/api/socket.io/" : "";

export const WEBSOCKET_URL = import.meta.env.VITE_DOCKERBUILD
    ? dockerBackendOrigin
        ? `${dockerBackendOrigin}/`
        : "/"
    : import.meta.env.PROD
      ? "/"
      : `${import.meta.env.VITE_BACKEND_ORIGIN || "http://localhost:5000"}/`;

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
    return fetch(`${BACKEND_ORIGIN}/${path}`, {
        method: method,
        headers: headers,
        redirect: "follow",
        body: JSON.stringify(body),
    });
};

export const scramblingDeviceBackendRequest = (
    path: string,
    method: string,
    body?: unknown
) => {
    const token = getScramblingDeviceToken();
    const headers = new Headers();
    headers.append("Content-Type", "application/json");
    headers.append("Authorization", `Token ${token}`);
    return fetch(`${BACKEND_ORIGIN}/${path}`, {
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
