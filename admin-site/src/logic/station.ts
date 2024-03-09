import { Station } from "./interfaces";
import { backendRequest } from "./request";

export const getAllStations = async () => {
    const response = await backendRequest("station", "GET", true);
    return await response.json();
};

export const createStation = async (name: string, espId: string) => {
    const response = await backendRequest("station", "POST", true, {
        name,
        espId,
    });
    return response.status;
};

export const updateStation = async (data: Station) => {
    const response = await backendRequest(
        `station/${data.id}`,
        "PUT",
        true,
        data
    );
    return response.status;
};

export const deleteStation = async (id: string) => {
    const response = await backendRequest(`station/${id}`, "DELETE", true);
    return response.status;
};
