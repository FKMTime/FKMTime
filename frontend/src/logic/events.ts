import { Round } from "@wca/helpers";

import { Event, UnofficialEvent } from "./interfaces";
import { backendRequest } from "./request";

const EVENTS_KEY = "fkmtime-events";

export const getEvents = async () => {
    const response = await backendRequest("events", "GET", true);
    const data = await response.json();
    localStorage.setItem(EVENTS_KEY, JSON.stringify(data));
    return data;
};

export const getUnofficialEvents = async () => {
    const events = await getEvents();
    return events.filter((event: Event) => event.isUnofficial);
};

export const isUnofficialEvent = (eventId: string) => {
    const eventsData = localStorage.getItem(EVENTS_KEY);
    if (eventsData) {
        const events: Event[] = JSON.parse(eventsData);
        return events.find((event) => event.id === eventId)?.isUnofficial;
    }
    return false;
};

export const getEventName = (eventId: string) => {
    const eventsData = localStorage.getItem(EVENTS_KEY);
    if (eventsData) {
        const events: Event[] = JSON.parse(eventsData);
        return events.find((event) => event.id === eventId)?.name;
    }
    return "";
};

export const getEventIconClass = (eventId: string) => {
    const eventsData = localStorage.getItem(EVENTS_KEY);
    if (eventsData) {
        const events: Event[] = JSON.parse(eventsData);
        return events.find((event) => event.id === eventId)?.icon;
    }
    return "";
};

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
