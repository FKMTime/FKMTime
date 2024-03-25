import { Activity, Competition } from "@wca/helpers";
import { getPersonFromWcif } from "./utils";
import { GroupAssigment } from "./interfaces";
import { Room as WCIFRoom } from "@wca/helpers/lib/models/room";

export const getAssigmentsList = (registrantId: number, wcif: Competition) => {
    const personInfo = getPersonFromWcif(registrantId, wcif);

    if (!personInfo) {
        return [];
    }

    const assigments: GroupAssigment[] = [];

    personInfo?.assignments?.forEach((assignment) => {
        const groupName = getActivityNameById(assignment.activityId, wcif);
        const groupInfo = getGroupInfoByActivityId(assignment.activityId, wcif);
        const activityName = prettyActivityName(assignment.assignmentCode);
        assigments.push({
            activityName,
            activityCode: groupInfo ? groupInfo.activityCode : "",
            groupName,
            groupId: assignment.activityId,
        });
    });

    return assigments.sort((a, b) => a.groupName.localeCompare(b.groupName));
};

export const getGroupInfoByActivityId = (
    activityId: number,
    wcif: Competition
) => {
    let group: Activity | null = null;
    wcif.schedule.venues.forEach((venue) => {
        venue.rooms.forEach((room) => {
            room.activities.forEach((activity) => {
                if (activity.id === activityId) {
                    group = activity;
                }
                activity.childActivities.forEach((childActivity) => {
                    if (childActivity.id === activityId) {
                        group = childActivity;
                    }
                });
            });
        });
    });
    return group as Activity | null;
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
    return activitiesToReturn.sort((a, b) =>
        a.activityCode.localeCompare(b.activityCode)
    );
};
