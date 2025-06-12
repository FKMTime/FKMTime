import { Check, ClockAlert, Replace } from "lucide-react";

import IconButton from "@/Components/IconButton";
import { StaffActivity } from "@/lib/interfaces";

interface AbsentPeopleListProps {
    staffActivities: StaffActivity[];
    handleMarkAsPresent: (id: string) => void;
    handleMarkAsLate: (id: string) => void;
    handleMarkAsPresentButReplaced: (id: string) => void;
}

const AbsentPeopleList = ({
    staffActivities,
    handleMarkAsPresent,
    handleMarkAsLate,
    handleMarkAsPresentButReplaced,
}: AbsentPeopleListProps) => {
    return (
        <ul>
            {staffActivities.map((activity) => (
                <li key={activity.id} className="flex items-center gap-2">
                    <div className="flex">
                        <IconButton
                            className="p-2"
                            onClick={() => handleMarkAsPresent(activity.id)}
                            icon={<Check />}
                        />
                        <IconButton
                            className="p-2"
                            onClick={() => handleMarkAsLate(activity.id)}
                            icon={<ClockAlert />}
                        />
                        <IconButton
                            className="p-2"
                            onClick={() =>
                                handleMarkAsPresentButReplaced(activity.id)
                            }
                            icon={<Replace />}
                        />
                    </div>
                    {activity.person.name}
                </li>
            ))}
        </ul>
    );
};

export default AbsentPeopleList;
