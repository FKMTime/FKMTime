import { ScramblingDevice } from "./interfaces";
import { backendRequest } from "./request";

export const defaultScramblingDevice: ScramblingDevice = {
    id: "",
    name: "",
    roomId: "",
    room: {
        id: "",
        name: "",
        currentGroupId: "",
        color: "",
    },
    createdAt: new Date(),
    updatedAt: new Date(),
};

export const getScramblingDevices = async () => {
    const response = await backendRequest("scrambling-device/", "GET", true);
    return await response.json();
};

export const createScramblingDevice = async (data: ScramblingDevice) => {
    const response = await backendRequest(
        `scrambling-device`,
        "POST",
        true,
        data
    );
    return response.status;
};

export const updateScramblingDevice = async (data: ScramblingDevice) => {
    const response = await backendRequest(
        `scrambling-device/${data.id}`,
        "PUT",
        true,
        data
    );
    return response.status;
};

export const deleteScramblingDevice = async (id: string) => {
    const response = await backendRequest(
        `scrambling-device/${id}`,
        "DELETE",
        true
    );
    return response.status;
};

export const getOneTimeCode = async (id: string) => {
    const response = await backendRequest(
        `scrambling-device/${id}/code`,
        "GET",
        true
    );
    return await response.json();
};
