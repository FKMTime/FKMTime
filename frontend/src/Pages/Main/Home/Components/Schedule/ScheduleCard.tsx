import { useNavigate } from "react-router-dom";

import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/Components/ui/card";
import { getActivityName } from "@/lib/activities";
import { Activity } from "@/lib/interfaces";
import { cn, formatTime, getFormattedRealActivityTime } from "@/lib/utils";

interface ScheduleCardProps {
    activity: Activity;
}

const ScheduleCard = ({ activity }: ScheduleCardProps) => {
    const navigate = useNavigate();
    const isRound = activity.activityCode.includes("-r");
    const formattedRealTime = getFormattedRealActivityTime(
        activity.realStartTime,
        activity.realEndTime
    );

    return (
        <Card
            onClick={() => {
                if (isRound) {
                    navigate(`/results/round/${activity.activityCode}`);
                }
            }}
            className={cn("w-full", isRound ? "cursor-pointer" : "")}
        >
            <CardHeader>
                <CardTitle>{getActivityName(activity)}</CardTitle>
                <CardDescription>Card Description</CardDescription>
            </CardHeader>
            <CardContent>
                <p>
                    {activity.childActivities.length === 0
                        ? ""
                        : `${activity.childActivities.length} ${activity.childActivities.length === 1 ? "group" : "groups"}`}
                </p>
                {formattedRealTime && <p>Real time: {formattedRealTime}</p>}
            </CardContent>
            <CardFooter>
                <p>
                    {formatTime(activity.startTime)} -{" "}
                    {formatTime(activity.endTime)}
                </p>
            </CardFooter>
        </Card>
    );
};

export default ScheduleCard;
