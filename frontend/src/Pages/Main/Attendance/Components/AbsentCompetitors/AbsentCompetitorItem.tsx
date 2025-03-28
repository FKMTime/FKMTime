import { LucideTimerReset } from "lucide-react";
import { useState } from "react";

import IconButton from "@/Components/IconButton";
import { StaffActivity } from "@/lib/interfaces";

import ChangeCompetingGroupModal from "./ChangeCompetingGroupModal";

interface AbsentCompetitorItemProps {
    activity: StaffActivity;
}

const AbsentCompetitorItem = ({ activity }: AbsentCompetitorItemProps) => {
    const [
        isOpenChangeCompetingGroupModal,
        setIsOpenChangeCompetingGroupModal,
    ] = useState<boolean>(false);

    const handleCloseChangeCompetingGroupModal = () => {
        setIsOpenChangeCompetingGroupModal(false);
    };

    return (
        <>
            <li key={activity.id} className="flex items-center gap-2">
                <IconButton
                    icon={<LucideTimerReset />}
                    onClick={() => setIsOpenChangeCompetingGroupModal(true)}
                />
                {activity.person.name}
            </li>
            <ChangeCompetingGroupModal
                isOpen={isOpenChangeCompetingGroupModal}
                onClose={() => handleCloseChangeCompetingGroupModal()}
                activity={activity}
            />
        </>
    );
};

export default AbsentCompetitorItem;
