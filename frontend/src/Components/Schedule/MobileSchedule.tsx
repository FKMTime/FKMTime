import { Activity } from "@wca/helpers";
import ScheduleCard from "./ScheduleCard.tsx";
import { Box } from "@chakra-ui/react";

interface MobileScheduleProps {
    activities: Activity[];
}

const MobileSchedule: React.FC<MobileScheduleProps> = ({ activities }) => {
    return (
        <Box display="flex" flexDirection="column" alignItems="center" gap="5">
            {activities.map((activity: Activity) => (
                <ScheduleCard key={activity.id} activity={activity} />
            ))}
        </Box>
    );
};

export default MobileSchedule;
