import { Check } from "lucide-react";

import IconButton from "@/Components/IconButton";
import { StaffActivity } from "@/lib/interfaces";

interface AbsentPeopleListProps {
    staffActivities: StaffActivity[];
    handleMarkAsPresent: (id: string) => void;
}

const AbsentPeopleList = ({
    staffActivities,
    handleMarkAsPresent,
}: AbsentPeopleListProps) => {
    return (
        <ul>
            {staffActivities.map((activity) => (
                <li key={activity.id} className="flex items-center gap-2">
                    <IconButton
                        onClick={() => handleMarkAsPresent(activity.id)}
                        icon={<Check />}
                    />
                    {activity.person.name}
                </li>
            ))}
        </ul>
    );
};

export default AbsentPeopleList;
