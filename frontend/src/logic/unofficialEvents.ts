import { Round } from "@wca/helpers";

import { UnofficialEvent } from "./interfaces";
import { backendRequest } from "./request";

export const createUnofficialEvent = async (
    eventId: string,
    rounds: Round[]
) => {
    const response = await backendRequest("events", "POST", true, {
        eventId,
        rounds,
    });
    return response.status;
};

export const getCompetitionUnofficialEvents = async () => {
    const response = await backendRequest(`events/unofficial`, "GET", true);
    return await response.json();
};

export const updateUnofficialEvent = async (
    unofficialEvent: UnofficialEvent
) => {
    const response = await backendRequest(
        `events/${unofficialEvent.id}`,
        "PUT",
        true,
        unofficialEvent
    );
    return response.status;
};

export const deleteUnofficialEvent = async (id: string) => {
    const response = await backendRequest(`events/${id}`, "DELETE", true);
    return response.status;
};
