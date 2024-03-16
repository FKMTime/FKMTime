import {Activity} from "@wca/helpers";
import {Card, CardBody, CardHeader, Heading, Text} from "@chakra-ui/react";
import {formatTime} from "../../logic/utils.ts";

interface ScheduleCardProps {
    activity: Activity;
}

const ScheduleCard: React.FC<ScheduleCardProps> = ({activity}) => {
    return (
        <Card
            backgroundColor="teal.500"
            color="white"
            textAlign="center"
            cursor="pointer"
            width="100%"
        >
            <CardHeader>
                <Heading size="md">
                    {activity.name}
                </Heading>
            </CardHeader>
            <CardBody>
                <Text>                {formatTime(activity.startTime)} -{" "}
                    {formatTime(activity.endTime)}
                </Text>
            </CardBody>
        </Card>
    );
};

export default ScheduleCard;
