import { Tr, Td } from "@chakra-ui/react";
import { Activity } from "@wca/helpers";
import { formatTime } from "../../../logic/utils";

interface ScheduleRowProps {
    activity: Activity;
}

const ScheduleRow: React.FC<ScheduleRowProps> = ({ activity }): JSX.Element => {
    return (
        <Tr key={activity.id}>
            <Td>{formatTime(activity.startTime)} - {formatTime(activity.endTime)}</Td>
            <Td>{activity.name}</Td>
            <Td>{activity.childActivities.length}</Td>
        </Tr>
    )
};

export default ScheduleRow;
