import { Card, CardBody, CardHeader, Heading, Text } from "@chakra-ui/react";
import { Activity } from "@wca/helpers";
import { useNavigate } from "react-router-dom";

import { formatTime } from "@/logic/utils";

interface ScheduleCardProps {
    activity: Activity;
}

const ScheduleCard = ({ activity }: ScheduleCardProps) => {
    const navigate = useNavigate();
    return (
        <Card
            backgroundColor="teal.500"
            color="white"
            textAlign="center"
            cursor="pointer"
            width="100%"
            onClick={() => {
                navigate(
                    `/results/round/${activity.activityCode.split("-g")[0]}`
                );
            }}
        >
            <CardHeader>
                <Heading size="md">{activity.name}</Heading>
            </CardHeader>
            <CardBody>
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
