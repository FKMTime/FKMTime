import { Activity, activityCodeToName, Competition } from "@wca/helpers";
import { Room as WCIFRoom } from "@wca/helpers/lib/models/room";

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
    return activitiesToReturn.sort((a, b) =>
        a.activityCode.localeCompare(b.activityCode)
    );
};

export const getActivityName = (activity: Activity) => {
    return activity.activityCode.startsWith("other")
        ? activity.name
        : activityCodeToName(activity.activityCode);
};
