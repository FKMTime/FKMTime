import { Activity, Competition } from "@/lib/interfaces";

import ScheduleCard from "./ScheduleCard";

interface MobileScheduleProps {
    activities: Activity[];
    competition: Competition;
}

const MobileSchedule = ({ activities, competition }: MobileScheduleProps) => {
    return (
        <div className="flex flex-col gap-5 items-center">
            <h2 className="text-2xl font-bold">Schedule</h2>
            {activities.map((activity: Activity) => (
                <ScheduleCard
                    key={activity.id}
                    activity={activity}
                    competition={competition}
                />
            ))}
        </div>
    );
};

export default MobileSchedule;
