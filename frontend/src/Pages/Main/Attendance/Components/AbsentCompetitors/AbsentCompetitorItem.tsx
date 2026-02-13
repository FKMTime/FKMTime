import { useAtomValue } from "jotai";
import { ArrowLeftRight } from "lucide-react";
import { useState } from "react";

import IconButton from "@/Components/IconButton";
import { competitionAtom } from "@/lib/atoms";
import { StaffActivity } from "@/lib/interfaces";
import { getRankingFromPreviousRound } from "@/lib/results";

import ChangeCompetingGroupModal from "./ChangeCompetingGroupModal";

interface AbsentCompetitorItemProps {
    activity: StaffActivity;
    fetchData: () => void;
    roundId: string;
}

const AbsentCompetitorItem = ({
    activity,
    fetchData,
    roundId,
}: AbsentCompetitorItemProps) => {
    const competition = useAtomValue(competitionAtom);
    const [
        isOpenChangeCompetingGroupModal,
        setIsOpenChangeCompetingGroupModal,
    ] = useState<boolean>(false);

    const handleCloseChangeCompetingGroupModal = () => {
        setIsOpenChangeCompetingGroupModal(false);
        fetchData();
    };

    const showRankingsFromPreviousRounds = +roundId.split("-r")[1] > 1;

    return (
        <>
            <li key={activity.id} className="flex items-center gap-2">
                <IconButton
                    icon={<ArrowLeftRight />}
                    onClick={() => setIsOpenChangeCompetingGroupModal(true)}
                />
                {activity.person.name}{" "}
                {showRankingsFromPreviousRounds &&
                    `(${getRankingFromPreviousRound(roundId, activity?.person?.registrantId || 0, competition?.wcif)})`}
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
