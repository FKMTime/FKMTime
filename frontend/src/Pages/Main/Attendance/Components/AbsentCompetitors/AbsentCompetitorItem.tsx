import { ArrowLeftRight } from "lucide-react";
import { useState } from "react";

import IconButton from "@/Components/IconButton";
import { StaffActivity } from "@/lib/interfaces";

import ChangeCompetingGroupModal from "./ChangeCompetingGroupModal";

interface AbsentCompetitorItemProps {
    activity: StaffActivity;
    fetchData: () => void;
}

const AbsentCompetitorItem = ({
    activity,
    fetchData,
}: AbsentCompetitorItemProps) => {
    const [
        isOpenChangeCompetingGroupModal,
        setIsOpenChangeCompetingGroupModal,
    ] = useState<boolean>(false);

    const handleCloseChangeCompetingGroupModal = () => {
        setIsOpenChangeCompetingGroupModal(false);
        fetchData();
    };

    return (
        <>
            <li key={activity.id} className="flex items-center gap-2">
                <IconButton
                    icon={<ArrowLeftRight />}
                    onClick={() => setIsOpenChangeCompetingGroupModal(true)}
                />
                {activity.person.name}
            </li>
            <ChangeCompetingGroupModal
                isOpen={isOpenChangeCompetingGroupModal}
                onClose={handleCloseChangeCompetingGroupModal}
                activity={activity}
            />
        </>
    );
};

export default AbsentCompetitorItem;
