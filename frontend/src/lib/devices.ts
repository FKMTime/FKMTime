import { Device, DeviceData } from "./interfaces";
import { backendRequest } from "./request";

export const getAllDevices = async (type?: string, roomId?: string) => {
    let url = "device";
    const searchParams = new URLSearchParams();
    if (type) searchParams.append("type", type);
    if (roomId) searchParams.append("roomId", roomId);
    if (searchParams.toString()) url += `?${searchParams.toString()}`;
    const response = await backendRequest(url, "GET", true);
    if (!response.ok) return [];
    return await response.json();
};

export const createDevice = async (data: DeviceData) => {
    const response = await backendRequest("device", "POST", true, data);
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
