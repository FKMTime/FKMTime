import { Card, CardBody, Heading, Text } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";

import { Activity } from "@/logic/interfaces.ts";
import { formatTime, getFormattedRealActivityTime } from "@/logic/utils";

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
            backgroundColor="teal.500"
            color="white"
            textAlign="center"
            cursor={isRound ? "pointer" : "default"}
            width="100%"
            onClick={() => {
                if (isRound) {
                    navigate(`/results/round/${activity.activityCode}`);
                }
            }}
        >
            <CardBody display="flex" flexDirection="column" gap="2">
                <Heading size="md">{activity.name}</Heading>
                <Text>
                    {activity.childActivities.length === 0
                        ? ""
                        : `${activity.childActivities.length} groups`}
                </Text>
                {formattedRealTime && (
                    <Text>Real time: {formattedRealTime}</Text>
                )}
                <Text>
                    {" "}
                    {formatTime(activity.startTime)} -{" "}
                    {formatTime(activity.endTime)}
                </Text>
            </CardBody>
        </Card>
    );
};

export default ScheduleCard;
