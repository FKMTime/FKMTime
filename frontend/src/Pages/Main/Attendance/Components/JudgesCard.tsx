import { Gavel } from "lucide-react";
import { useMemo, useState } from "react";

import PlusButton from "@/Components/PlusButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { StaffActivity, StaffActivityStatus } from "@/lib/interfaces";

import AbsentPeopleList from "./AbsentPeopleList";
import AddNotAssignedPersonModal from "./AddNotAssignedPersonModal";
import PresentPeopleList from "./PresentPeopleList";

interface JudgesCardProps {
    attendance: StaffActivity[];
    handleMarkAsPresent: (staffActivityId: string) => void;
    handleMarkAsAbsent: (staffActivityId: string) => void;
    handleMarkAsLate: (staffActivityId: string) => void;
    handleMarkAsPresentButReplaced: (staffActivityId: string) => void;
    fetchData: () => void;
    groupId: string;
}

const JudgesCard = ({
    attendance,
    handleMarkAsPresent,
    handleMarkAsAbsent,
    handleMarkAsLate,
    handleMarkAsPresentButReplaced,
    fetchData,
    groupId,
}: JudgesCardProps) => {
    const [
        isOpenAddNotAssignedPersonModal,
        setIsOpenAddNotAssignedPersonModal,
    ] = useState<boolean>(false);

    const presentJudges = useMemo(() => {
        return attendance.filter(
            (a) =>
                a.role === "JUDGE" &&
                [
                    StaffActivityStatus.PRESENT,
                    StaffActivityStatus.REPLACED,
                    StaffActivityStatus.LATE,
                ].includes(a.status)
        );
    }, [attendance]);

    const absentJudges = useMemo(() => {
        return attendance.filter(
            (a) => a.role === "JUDGE" && a.status === StaffActivityStatus.ABSENT
        );
    }, [attendance]);

    const noJudges = absentJudges.length === 0 && presentJudges.length === 0;

    const handleCloseAddNotAssignedPersonModal = () => {
        setIsOpenAddNotAssignedPersonModal(false);
        fetchData();
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex justify-between">
                    <div className="flex gap-1 items-center">
                        <Gavel />
                        Judges
                    </div>
                    <PlusButton
                        onClick={() => setIsOpenAddNotAssignedPersonModal(true)}
                    />
                </CardTitle>
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
                                    handleMarkAsLate={handleMarkAsLate}
                                    handleMarkAsPresentButReplaced={
                                        handleMarkAsPresentButReplaced
                                    }
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
            <AddNotAssignedPersonModal
                isOpen={isOpenAddNotAssignedPersonModal}
                onClose={() => handleCloseAddNotAssignedPersonModal()}
                role="JUDGE"
                groupId={groupId}
            />
        </Card>
    );
};

export default JudgesCard;
