import { SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";

import IconButton from "@/Components/IconButton";
import { StaffActivity, StaffActivityStatus } from "@/lib/interfaces";

import DetailsModal from "./DetailsModal";

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
    const [staffActivityToShowDetails, setStaffActivityToShowDetails] =
        useState<StaffActivity | null>(null);
    const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);

    const handleOpenDetailsModal = (staffActivity: StaffActivity) => {
        setStaffActivityToShowDetails(staffActivity);
        setShowDetailsModal(true);
    };
    return (
        <>
            <ul>
                {staffActivities.map((activity) => (
                    <li key={activity.id} className="flex items-center gap-2">
                        <IconButton
                            color="white"
                            onClick={() => handleMarkAsAbsent(activity.id)}
                            icon={<X />}
                        />
                        <IconButton
                            className="p-2"
                            onClick={() => handleOpenDetailsModal(activity)}
                            icon={<SlidersHorizontal />}
                        />
                        {activity.person.name}
                        {showDevice &&
                            activity.device &&
                            ` - station ${activity.device.name}`}
                        {!activity.isAssigned && " (unassigned)"}
                        {activity.status === StaffActivityStatus.REPLACED &&
                            " (replaced)"}
                        {activity.status === StaffActivityStatus.LATE &&
                            " (late)"}
                    </li>
                ))}
            </ul>
            <DetailsModal
                isOpen={showDetailsModal}
                onClose={() => setShowDetailsModal(false)}
                staffActivity={staffActivityToShowDetails}
            />
        </>
    );
};

export default PresentPeopleList;
