import { Card, CardBody, Heading, Text } from "@chakra-ui/react";
import { Activity } from "@wca/helpers";
import { useNavigate } from "react-router-dom";

import { formatTime } from "@/logic/utils";

interface ScheduleCardProps {
    activity: Activity;
}

const ScheduleCard = ({ activity }: ScheduleCardProps) => {
    const navigate = useNavigate();
    const isRound = activity.activityCode.includes("-r");

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
