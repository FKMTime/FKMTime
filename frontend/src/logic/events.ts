import { Event } from "./interfaces";
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

export const getEventShortName = (eventId: string) => {
    const eventsData = localStorage.getItem(EVENTS_KEY);
    if (eventsData) {
        const events: Event[] = JSON.parse(eventsData);
        const event = events.find((e) => e.id === eventId);
        return event?.shortName || event?.name;
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

export const getUsualScramblesCount = (eventId: string) => {
    const eventsData = localStorage.getItem(EVENTS_KEY);
    if (eventsData) {
        const events: Event[] = JSON.parse(eventsData);
        return events.find((event) => event.id === eventId)
            ?.usualScramblesCount;
    }
    return 5;
};

export const getUsualExtraScramblesCount = (eventId: string) => {
    const eventsData = localStorage.getItem(EVENTS_KEY);
    if (eventsData) {
        const events: Event[] = JSON.parse(eventsData);
        return events.find((event) => event.id === eventId)
            ?.usualExtraScramblesCount;
    }
    return 2;
};
