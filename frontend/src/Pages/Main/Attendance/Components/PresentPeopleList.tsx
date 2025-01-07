import { MdClose } from "react-icons/md";

import IconButton from "@/Components/IconButton";
import { StaffActivity } from "@/lib/interfaces";

interface PresentPeopleListProps {
    staffActivities: StaffActivity[];
    handleMarkAsAbsent: (id: string) => void;
    showDevice?: boolean;
}

const PresentPeopleList = ({
    staffActivities,
    handleMarkAsAbsent,
    showDevice,
}: PresentPeopleListProps) => {
    return (
        <ul className="">
            {staffActivities.map((activity) => (
                <li key={activity.id} className="flex items-center gap-2">
                    <IconButton
                        color="white"
                        onClick={() => handleMarkAsAbsent(activity.id)}
                        icon={<MdClose />}
                    />
                    {activity.person.name}
                    {showDevice &&
                        activity.device &&
                        ` - station ${activity.device.name}`}
                    {!activity.isAssigned && " (unassigned)"}
                </li>
            ))}
        </ul>
    );
};

export default PresentPeopleList;
