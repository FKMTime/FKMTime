import { Activity } from "@/lib/interfaces";

import ScheduleCard from "./ScheduleCard";

interface MobileScheduleProps {
    activities: Activity[];
}

const MobileSchedule = ({ activities }: MobileScheduleProps) => {
    return (
        <div className="flex flex-col gap-5 items-center">
            <h2 className="text-2xl font-bold">Schedule</h2>
            {activities.map((activity: Activity) => (
                <ScheduleCard key={activity.id} activity={activity} />
            ))}
        </div>
    );
};

export default MobileSchedule;
