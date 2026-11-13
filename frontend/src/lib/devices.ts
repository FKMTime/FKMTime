import { activityCodeToName } from "./activities";
import { Device, DeviceData, DeviceType } from "./interfaces";
import { backendQuery, backendRequest } from "./request";

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

export const devicesQuery = backendQuery<Device[]>("device");

/** Every timing station, so live solving can list idle ones too */
export const stationDevicesQuery = backendQuery<Device[]>(
    "device?type=STATION"
);

export const retiredDevicesQuery = backendQuery<Device[]>("device/retired");

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

export const reconnectDevice = async (id: string) => {
    const response = await backendRequest(
        `device/${id}/reconnect`,
        "POST",
        true
    );
    return response.status;
};

export const restoreDevice = async (id: string) => {
    const response = await backendRequest(`device/${id}/restore`, "POST", true);
    return response.status;
};

/**
 * Points stations at a round, or sends them back to their room's groups with
 * a null round (SPEC-007)
 */
export const setStationsRound = async (
    deviceIds: string[],
    roundId: string | null
) => {
    const response = await backendRequest("device/custom-round", "PUT", true, {
        deviceIds,
        roundId,
    });
    return response.status;
};

/** "Station 1", "Station 1 and Station 2", "Station 1, Station 2 and Station 3" */
export const joinNames = (names: string[]) =>
    names.length > 1
        ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
        : names[0] ?? "";

/** What pointing stations at a round does, in the delegate's words */
export const runDifferentRoundSummary = (
    stationNames: string[],
    roundId: string
) =>
    `${joinNames(stationNames)} will only take attempts for ${activityCodeToName(roundId)}. Other stations carry on with their room's groups.`;

/** Stations pointed at another round than their room's */
export const getPointedStations = (devices: Device[]) =>
    devices.filter(
        (device) =>
            device.type === DeviceType.STATION &&
            !device.retiredAt &&
            !!device.customRoundId
    );

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
        const aName = a.name ?? "";
        const bName = b.name ?? "";
        const na = Number(aName);
        const nb = Number(bName);

        const aIsNum = !Number.isNaN(na) && aName !== "";
        const bIsNum = !Number.isNaN(nb) && bName !== "";

        if (aIsNum && bIsNum) {
            return na - nb;
        }

        if (aIsNum) return -1;
        if (bIsNum) return 1;

        return aName.localeCompare(bName);
    });
};
