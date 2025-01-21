import { useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { StaffActivity } from "@/lib/interfaces";

import UnorderedPeopleList from "./UnorderedPeopleList";

interface CompetitorsCardProps {
    attendance: StaffActivity[];
}
const CompetitorsCard = ({ attendance }: CompetitorsCardProps) => {
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
                <CardTitle>Competitors</CardTitle>
            </CardHeader>
            <CardContent>
                {noCompetitors ? (
                    <h2 className="text-lg">No competitors in this group</h2>
                ) : (
                    <div className="flex flex-col gap-5">
                        {absentCompetitors.length > 0 && (
                            <div className="flex flex-col gap-2">
                                <h2 className="font-bold text-lg">Absent</h2>
                                <UnorderedPeopleList
                                    persons={absentCompetitors}
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
