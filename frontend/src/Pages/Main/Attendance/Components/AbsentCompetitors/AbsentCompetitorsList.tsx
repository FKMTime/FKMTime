import { StaffActivity } from "@/lib/interfaces";

import AbsentCompetitorItem from "./AbsentCompetitorItem";

interface AbsentCompetitorsListProps {
    staffActivities: StaffActivity[];
    fetchData: () => void;
}

const AbsentCompetitorsList = ({
    staffActivities,
    fetchData,
}: AbsentCompetitorsListProps) => {
    return (
        <ul>
            {staffActivities.map((activity) => (
                <AbsentCompetitorItem
                    activity={activity}
                    fetchData={fetchData}
                />
            ))}
        </ul>
    );
};

export default AbsentCompetitorsList;
