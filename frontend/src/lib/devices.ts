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

export const createDevice = async (
    data: DeviceData
): Promise<{ status: number; device?: Device }> => {
    const response = await backendRequest("device", "POST", true, data);
    if (!response.ok) return { status: response.status };
    const device = await response.json();
    return { status: response.status, device };
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

export const uploadFirmware = async (fileName: string, fileData: string) => {
    const response = await backendRequest(
        "device/upload-firmware",
        "POST",
        true,
        {
            fileName,
            fileData,
        }
    );
    return response.status;
};

export const sortDevicesByName = (devices: Device[]) => {
    return devices.sort((a: Device, b: Device) => {
        const aName = a.name ?? '';
        const bName = b.name ?? '';
        const na = Number(aName);
        const nb = Number(bName);

        const aIsNum = !Number.isNaN(na) && aName !== '';
        const bIsNum = !Number.isNaN(nb) && bName !== '';

        if (aIsNum && bIsNum) {
            return na - nb;
        }

        if (aIsNum) return -1;
        if (bIsNum) return 1;

        return aName.localeCompare(bName);
    });
};
