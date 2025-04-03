import { Users } from "lucide-react";
import { useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { StaffActivity } from "@/lib/interfaces";

import AbsentCompetitorsList from "./AbsentCompetitors/AbsentCompetitorsList";
import UnorderedPeopleList from "./UnorderedPeopleList";

interface CompetitorsCardProps {
    attendance: StaffActivity[];
    fetchData: () => void;
}
const CompetitorsCard = ({ attendance, fetchData }: CompetitorsCardProps) => {
    const presentCompetitors = useMemo(() => {
        return attendance.filter((a) => a.role === "COMPETITOR" && a.isPresent);
    }, [attendance]);
    const absentCompetitors = useMemo(() => {
        return attendance.filter(
            (a) => a.role === "COMPETITOR" && !a.isPresent
        );
    }, [attendance]);

    const noCompetitors =
        absentCompetitors.length === 0 && presentCompetitors.length === 0;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex gap-1 items-center">
                    <Users />
                    Competitors
                </CardTitle>
            </CardHeader>
            <CardContent>
                {noCompetitors ? (
                    <h2 className="text-lg">No competitors in this group</h2>
                ) : (
                    <div className="flex flex-col gap-5">
                        {absentCompetitors.length > 0 && (
                            <div className="flex flex-col gap-2">
                                <h2 className="font-bold text-lg">Absent</h2>
                                <AbsentCompetitorsList
                                    staffActivities={absentCompetitors}
                                    fetchData={fetchData}
                                />
                            </div>
                        )}
                        {presentCompetitors.length > 0 && (
                            <div className="flex flex-col gap-2">
                                <h2 className="font-bold text-lg">Present</h2>
                                <UnorderedPeopleList
                                    persons={presentCompetitors}
                                />
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default CompetitorsCard;
