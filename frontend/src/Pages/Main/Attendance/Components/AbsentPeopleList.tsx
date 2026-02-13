import { Check, ClockAlert, Replace, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import IconButton from "@/Components/IconButton";
import { StaffActivity } from "@/lib/interfaces";

import DetailsModal from "./DetailsModal";

interface AbsentPeopleListProps {
    staffActivities: StaffActivity[];
    handleMarkAsPresent: (id: string) => void;
    handleMarkAsLate: (id: string) => void;
    handleMarkAsPresentButReplaced: (staffActivityId: string) => void;
}

const AbsentPeopleList = ({
    staffActivities,
    handleMarkAsPresent,
    handleMarkAsLate,
    handleMarkAsPresentButReplaced,
}: AbsentPeopleListProps) => {
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
                    <li
                        key={activity.id}
                        className="flex items-center gap-2 flex-wrap"
                    >
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
                            <IconButton
                                className="p-2"
                                onClick={() => handleOpenDetailsModal(activity)}
                                icon={<SlidersHorizontal />}
                            />
                        </div>
                        {activity.person.name}
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

export default AbsentPeopleList;
