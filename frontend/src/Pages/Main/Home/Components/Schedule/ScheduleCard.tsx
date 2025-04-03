import { useNavigate } from "react-router-dom";

import EventIcon from "@/Components/Icons/EventIcon";
import { Button } from "@/Components/ui/button";
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
                <CardTitle className="flex gap-1 items-center">
                    {!activity.activityCode.startsWith("other") && (
                        <EventIcon
                            eventId={activity.activityCode.split("-r")[0]}
                            selected
                            size={20}
                        />
                    )}
                    {getActivityName(activity)}
                </CardTitle>
                <CardDescription>
                    {activity.childActivities.length === 0
                        ? ""
                        : `${activity.childActivities.length} ${activity.childActivities.length === 1 ? "group" : "groups"}`}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {!activity.activityCode.startsWith("other") && (
                    <Button
                        onClick={() =>
                            navigate(`/results/round/${activity.activityCode}`)
                        }
                        variant="success"
                    >
                        Results
                    </Button>
                )}
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
