import { Device } from "./interfaces";
import { backendRequest } from "./request";

export const getAllDevices = async (type?: string) => {
    const url = type ? `device?type=${type}` : "device";
    const response = await backendRequest(url, "GET", true);
    if (!response.ok) return [];
    return await response.json();
};

export const createDevice = async (
    name: string,
    espId: number,
    type: string,
    roomId: string
) => {
    const response = await backendRequest("device", "POST", true, {
        name,
        espId,
        roomId,
        type,
    });
    return response.status;
};

export const updateDevice = async (data: Device) => {
    const response = await backendRequest(
        `device/${data.id}`,
        "PUT",
        true,
        data
    );
    return response.status;
};

export const deleteDevice = async (id: string) => {
    const response = await backendRequest(`device/${id}`, "DELETE", true);
    return response.status;
};
