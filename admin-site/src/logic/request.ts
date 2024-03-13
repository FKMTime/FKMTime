import { getToken } from "./auth";

const BACKEND_URL = import.meta.env.PROD
    ? "/api/"
    : "http://192.168.2.39:5000/";

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
    return fetch(`${BACKEND_URL}${path}`, {
        method: method,
        headers: headers,
        redirect: "follow",
        body: JSON.stringify(body),
    });
};
