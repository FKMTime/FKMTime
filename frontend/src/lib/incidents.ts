import {
    Incident,
    ManualIncident,
    NoteworthyIncident,
    NoteworthyIncidentData,
} from "./interfaces";
import { backendRequest } from "./request";

export const groupIncidents = (incidents: Incident[]) => {
    const grouped: { [key: string]: Incident[] } = {};

    incidents.forEach((incident) => {
        const comment = incident.comment?.toLowerCase() || "other";
        if (!grouped[comment]) {
            grouped[comment] = [];
        }
        grouped[comment].push(incident);
    });

    return Object.keys(grouped).map((category) => ({
        category,
        incidents: grouped[category],
    }));
};

export const getUnresolvedIncidentsCount = async () => {
    const response = await backendRequest(
        "incident/unresolved/count",
        "GET",
        true
    );
    return await response.json();
};

export const getUnresolvedIncidents = async (): Promise<Incident[]> => {
    const response = await backendRequest("incident/unresolved", "GET", true);
    return await response.json();
};

export const getResolvedIncidents = async (
    search?: string
): Promise<Incident[]> => {
    const url = search
        ? `incident/resolved?search=${search}`
        : "incident/resolved";
    const response = await backendRequest(url, "GET", true);
    return await response.json();
};

export const saveAttemptAsNoteworthyIncident = async (id: string) => {
    const response = await backendRequest(
        `incident/noteworthy/save/${id}`,
        "POST",
        true
    );
    return response.status;
};

export const getNoteworthyIncidents = async (
    search?: string
): Promise<NoteworthyIncident[]> => {
    const url = search
        ? `incident/noteworthy?search=${search}`
        : "incident/noteworthy";
    const response = await backendRequest(url, "GET", true);
    return await response.json();
};

export const createNoteworthyIncident = async (
    data: NoteworthyIncidentData
) => {
    const response = await backendRequest(
        "incident/noteworthy",
        "POST",
        true,
        data
    );
    return response.status;
};

export const updateNoteworthyIncident = async (
    id: string,
    data: NoteworthyIncidentData
) => {
    const response = await backendRequest(
        `incident/noteworthy/${id}`,
        "PUT",
        true,
        data
    );
    return response.status;
};

export const deleteNoteworthyIncident = async (id: string) => {
    const response = await backendRequest(
        `incident/noteworthy/${id}`,
        "DELETE",
        true
    );
    return response.status;
};

export const getManualIncidents = async (
    search?: string
): Promise<ManualIncident[]> => {
    const url = search ? `incident/manual?search=${search}` : "incident/manual";
    const response = await backendRequest(url, "GET", true);
    return await response.json();
};

export const createManualIncident = async (data: {
    personId: string;
    roundId: string;
    description: string;
}) => {
    const response = await backendRequest(
        "incident/manual",
        "POST",
        true,
        data
    );
    return response.status;
};

export const deleteManualIncident = async (id: string) => {
    const response = await backendRequest(
        `incident/manual/${id}`,
        "DELETE",
        true
    );
    return response.status;
};

export const updateManualIncident = async (
    id: string,
    data: { personId: string; roundId: string; description: string }
) => {
    const response = await backendRequest(
        `incident/manual/${id}`,
        "PUT",
        true,
        data
    );
    return response.status;
};
