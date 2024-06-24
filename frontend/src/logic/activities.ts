import {
    Activity,
    activityCodeToName as wcifActivityCodeToName,
    Competition,
} from "@wca/helpers";
import { Room as WCIFRoom } from "@wca/helpers/lib/models/room";

import { getEventName, isUnofficialEvent } from "./events";

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
    const eventId = roundId.split("-")[0];
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

export const activityCodeToName = (activityCode: string) => {
    const eventId = activityCode.split("-r")[0];
    if (isUnofficialEvent(eventId)) {
        return `${getEventName(eventId)}, Round ${activityCode.split("-g")[0].split("-r")[1]}`;
    } else {
        return wcifActivityCodeToName(activityCode);
    }
};
