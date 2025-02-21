import {
    Activity,
    activityCodeToName as wcifActivityCodeToName,
    Competition,
    Room as WCIFRoom,
} from "@wca/helpers";

import { getEventName, getEventShortName, isUnofficialEvent } from "./events";

export const getEventIdFromRoundId = (roundId: string) => {
    return roundId.split("-")[0];
};

export const prettyActivityName = (activity: string) => {
    switch (activity) {
        case "COMPETITOR":
            return "Competitor";
        case "JUDGE":
            return "Judge";
        case "RUNNER":
            return "Runner";
        case "SCRAMBLER":
            return "Scrambler";
        default:
            return "Unknown activity";
    }
};

export const getGroupsByRoundId = (roundId: string, wcif: Competition) => {
    let activitiesToReturn: Activity[] = [];
    wcif.schedule.venues[0].rooms.forEach((room: WCIFRoom) => {
        room.activities.forEach((activity: Activity) => {
            if (activity.activityCode === roundId) {
                activitiesToReturn = activitiesToReturn.concat(
                    activity.childActivities
                );
            }
        });
    });
    const eventId = getEventIdFromRoundId(roundId);
    if (isUnofficialEvent(eventId)) {
        activitiesToReturn.push({
            id: 1,
            activityCode: `${roundId}-g1`,
            name: `${getEventName(eventId)}, Round 1, Group 1`,
            startTime: "",
            endTime: "",
            childActivities: [],
            extensions: [],
        });
    }
    return activitiesToReturn.sort((a, b) =>
        a.activityCode.localeCompare(b.activityCode)
    );
};

export const getActivityName = (activity: Activity) => {
    return activity.activityCode.startsWith("other")
        ? activity.name
        : activityCodeToName(activity.activityCode);
};

export const activityCodeToName = (
    activityCode: string,
    shortEvent?: boolean,
    shortRound?: boolean,
    shortGroup?: boolean
): string => {
    if (!activityCode) return "";

    const [eventId, roundAndGroup] = activityCode.split("-r");
    const eventName = getEventName(eventId);

    let finalName = isUnofficialEvent(eventId)
        ? `${eventName}, Round ${roundAndGroup?.split("-g")[0]}`
        : wcifActivityCodeToName(activityCode);

    if (shortEvent) {
        finalName = finalName.replace(
            eventName || "",
            getEventShortName(eventId) || ""
        );
    }
    if (shortRound) {
        finalName = finalName.replace("Round ", "R");
    }

    if (shortGroup) {
        finalName = finalName.replace("Group ", "G");
    }

    return finalName;
};
