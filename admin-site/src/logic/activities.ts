import { Competition } from "@wca/helpers";
import { getPersonFromWcif } from "./utils";
import { GroupAssigment } from "./interfaces";

export const getAssigmentsList = (registrantId: number, wcif: Competition) => {
    const personInfo = getPersonFromWcif(registrantId, wcif);

    if (!personInfo) {
        return [];
    }

    const assigments: GroupAssigment[] = [];

    personInfo?.assignments?.forEach((assignment) => {
        const groupName = getActivityNameById(assignment.activityId, wcif);
        const activityName = prettyActivityName(assignment.assignmentCode);
        assigments.push({
            activityName,
            groupName,
            groupId: assignment.activityId,
        });
    });

    return assigments.sort((a, b) => a.groupName.localeCompare(b.groupName));
};

export const prettyActivityName = (activity: string) => {
    switch (activity) {
        case "competitor":
            return "Competitor";
        case "staff-judge":
            return "Judge";
        case "staff-runner":
            return "Runner";
        case "staff-scrambler":
            return "Scrambler";
        default:
            return "";
    }
};

export const getActivityNameById = (activityId: number, wcif: Competition) => {
    let activityName = "";
    wcif.schedule.venues.forEach((venue) => {
        venue.rooms.forEach((room) => {
            room.activities.forEach((activity) => {
                if (activity.id === activityId) {
                    activityName = activity.name;
                }
                activity.childActivities.forEach((childActivity) => {
                    if (childActivity.id === activityId) {
                        activityName = childActivity.name;
                    }
                });
            });
        });
    });
    return activityName;
};
