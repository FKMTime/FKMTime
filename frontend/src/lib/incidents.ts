import { Incident } from "./interfaces";
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
        "attempt/unresolved/count",
        "GET",
        true
    );
    return await response.json();
};
