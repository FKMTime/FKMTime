import { Warning, WarningData } from "./interfaces";
import { backendRequest, backendSearchQuery } from "./request";

export const warningsQuery = backendSearchQuery<Warning[]>("incident/warnings");

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
