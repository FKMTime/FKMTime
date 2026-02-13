import { useAtomValue } from "jotai";

import { competitionAtom } from "@/lib/atoms";
import { StaffActivity } from "@/lib/interfaces";
import { getRankingFromPreviousRound } from "@/lib/results";

import AbsentCompetitorItem from "./AbsentCompetitorItem";

interface AbsentCompetitorsListProps {
    staffActivities: StaffActivity[];
    fetchData: () => void;
    groupId: string;
}

const AbsentCompetitorsList = ({
    staffActivities,
    fetchData,
    groupId,
}: AbsentCompetitorsListProps) => {
    //TODO: move to  competitors card
    const competition = useAtomValue(competitionAtom);
    const roundId = groupId.split("-g")[0];

    const orderedStaffActivities = staffActivities.sort((a, b) => {
        const rankingA = getRankingFromPreviousRound(
            groupId,
            a.person.registrantId || 0,
            competition?.wcif
        );
        const rankingB = getRankingFromPreviousRound(
            groupId,
            b.person.registrantId || 0,
            competition?.wcif
        );
        return (rankingA || Infinity) - (rankingB || Infinity);
    });

    return (
        <ul>
            {orderedStaffActivities.map((activity) => (
                <AbsentCompetitorItem
                    key={activity.id}
                    activity={activity}
                    fetchData={fetchData}
                    roundId={roundId}
                />
            ))}
        </ul>
    );
};

export default AbsentCompetitorsList;
