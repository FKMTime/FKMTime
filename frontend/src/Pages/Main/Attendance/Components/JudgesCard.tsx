import { useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { StaffActivity } from "@/lib/interfaces";

import AbsentPeopleList from "./AbsentPeopleList";
import PresentPeopleList from "./PresentPeopleList";

interface JudgesCardProps {
    attendance: StaffActivity[];
    handleMarkAsPresent: (staffActivityId: string) => void;
    handleMarkAsAbsent: (staffActivityId: string) => void;
}

const JudgesCard = ({
    attendance,
    handleMarkAsPresent,
    handleMarkAsAbsent,
}: JudgesCardProps) => {
    const presentJudges = useMemo(() => {
        return attendance.filter((a) => a.role === "JUDGE" && a.isPresent);
    }, [attendance]);

    const absentJudges = useMemo(() => {
        return attendance.filter((a) => a.role === "JUDGE" && !a.isPresent);
    }, [attendance]);

    const noJudges = absentJudges.length === 0 && presentJudges.length === 0;
    return (
        <Card>
            <CardHeader>
                <CardTitle>Judges</CardTitle>
            </CardHeader>
            <CardContent>
                {noJudges ? (
                    <h2 className="text-lg">No judges in this group</h2>
                ) : (
                    <div className="flex flex-col gap-5">
                        {absentJudges.length > 0 && (
                            <div className="flex flex-col gap-2">
                                <h2 className="font-bold text-lg">Absent</h2>
                                <AbsentPeopleList
                                    staffActivities={absentJudges}
                                    handleMarkAsPresent={handleMarkAsPresent}
                                />
                            </div>
                        )}
                        {presentJudges.length > 0 && (
                            <div className="flex flex-col gap-2">
                                <h2 className="font-bold text-lg">Present</h2>
                                <PresentPeopleList
                                    staffActivities={presentJudges}
                                    handleMarkAsAbsent={handleMarkAsAbsent}
                                    showDevice
                                />
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default JudgesCard;
