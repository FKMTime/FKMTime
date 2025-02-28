import { WarningData } from "./interfaces";
import { backendRequest } from "./request";

export const getAllWarnings = async (search?: string) => {
    const url = search
        ? `incident/warnings?search=${search}`
        : "incident/warnings";

    const response = await backendRequest(url, "GET", true);
    return await response.json();
};

export const getWarningsForPerson = async (personId: string) => {
    const response = await backendRequest(
        `incident/warnings/person/${personId}`,
        "GET",
        true
    );
    return await response.json();
};

export const issueWarning = async (personId: string, data: WarningData) => {
    const response = await backendRequest(
        `incident/warnings/person/${personId}`,
        "POST",
        true,
        data
    );
    return response.status;
};

export const deleteWarning = async (id: string) => {
    const response = await backendRequest(
        `incident/warnings/${id}`,
        "DELETE",
        true
    );
    return response.status;
};
