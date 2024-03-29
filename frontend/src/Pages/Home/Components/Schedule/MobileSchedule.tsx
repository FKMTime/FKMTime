import { Box } from "@chakra-ui/react";
import { Activity } from "@wca/helpers";

import ScheduleCard from "./ScheduleCard";

interface MobileScheduleProps {
    activities: Activity[];
}

const MobileSchedule = ({ activities }: MobileScheduleProps) => {
    return (
        <Box display="flex" flexDirection="column" alignItems="center" gap="5">
            {activities.map((activity: Activity) => (
                <ScheduleCard key={activity.id} activity={activity} />
            ))}
        </Box>
    );
};

export default MobileSchedule;
