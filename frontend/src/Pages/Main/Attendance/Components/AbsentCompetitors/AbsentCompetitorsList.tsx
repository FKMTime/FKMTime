import { StaffActivity } from "@/lib/interfaces";

import AbsentCompetitorItem from "./AbsentCompetitorItem";

interface AbsentCompetitorsListProps {
    staffActivities: StaffActivity[];
}

const AbsentCompetitorsList = ({
    staffActivities,
}: AbsentCompetitorsListProps) => {
    return (
        <ul>
            {staffActivities.map((activity) => (
                <AbsentCompetitorItem activity={activity} />
            ))}
        </ul>
    );
};

export default AbsentCompetitorsList;
