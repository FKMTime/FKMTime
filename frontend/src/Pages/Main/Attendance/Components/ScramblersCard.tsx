import { useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { StaffActivity } from "@/lib/interfaces";

import AbsentPeopleList from "./AbsentPeopleList";
import PresentPeopleList from "./PresentPeopleList";

interface ScramblersCardProps {
    attendance: StaffActivity[];
    handleMarkAsPresent: (staffActivityId: string) => void;
    handleMarkAsAbsent: (staffActivityId: string) => void;
}

const ScramblersCard = ({
    attendance,
    handleMarkAsPresent,
    handleMarkAsAbsent,
}: ScramblersCardProps) => {
    const presentScramblers = useMemo(() => {
        return attendance.filter((a) => a.role === "SCRAMBLER" && a.isPresent);
    }, [attendance]);
    const absentScramblers = useMemo(() => {
        return attendance.filter((a) => a.role === "SCRAMBLER" && !a.isPresent);
    }, [attendance]);

    const noScramblers =
        absentScramblers.length === 0 && presentScramblers.length === 0;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Scramblers</CardTitle>
            </CardHeader>
            <CardContent>
                {noScramblers ? (
                    <h2 className="text-lg">No scramblers in this group</h2>
                ) : (
                    <div className="flex flex-col gap-5">
                        {absentScramblers.length > 0 && (
                            <div className="flex flex-col gap-2">
                                <h2 className="font-bold text-lg">Absent</h2>
                                <AbsentPeopleList
                                    staffActivities={absentScramblers}
                                    handleMarkAsPresent={handleMarkAsPresent}
                                />
                            </div>
                        )}
                        {presentScramblers.length > 0 && (
                            <div className="flex flex-col gap-2">
                                <h2 className="font-bold text-lg">Present</h2>
                                <PresentPeopleList
                                    staffActivities={presentScramblers}
                                    handleMarkAsAbsent={handleMarkAsAbsent}
                                />
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default ScramblersCard;
