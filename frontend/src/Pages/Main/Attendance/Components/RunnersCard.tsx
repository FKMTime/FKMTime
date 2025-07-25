import { PersonStanding } from "lucide-react";
import { useMemo, useState } from "react";

import PlusButton from "@/Components/PlusButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { StaffActivity, StaffActivityStatus } from "@/lib/interfaces";

import AbsentPeopleList from "./AbsentPeopleList";
import AddNotAssignedPersonModal from "./AddNotAssignedPersonModal";
import PresentPeopleList from "./PresentPeopleList";

interface RunnersCardProps {
    attendance: StaffActivity[];
    handleMarkAsPresent: (staffActivityId: string) => void;
    handleMarkAsAbsent: (staffActivityId: string) => void;
    handleMarkAsLate: (staffActivityId: string) => void;
    handleMarkAsPresentButReplaced: (staffActivityId: string) => void;
    fetchData: () => void;
    groupId: string;
}

const RunnersCard = ({
    attendance,
    handleMarkAsPresent,
    handleMarkAsAbsent,
    handleMarkAsLate,
    handleMarkAsPresentButReplaced,
    fetchData,
    groupId,
}: RunnersCardProps) => {
    const [
        isOpenAddNotAssignedPersonModal,
        setIsOpenAddNotAssignedPersonModal,
    ] = useState<boolean>(false);

    const presentRunners = useMemo(() => {
        return attendance.filter(
            (a) =>
                a.role === "RUNNER" &&
                [
                    StaffActivityStatus.PRESENT,
                    StaffActivityStatus.REPLACED,
                    StaffActivityStatus.LATE,
                ].includes(a.status)
        );
    }, [attendance]);
    const absentRunners = useMemo(() => {
        return attendance.filter(
            (a) =>
                a.role === "RUNNER" && a.status === StaffActivityStatus.ABSENT
        );
    }, [attendance]);

    const noRunners = absentRunners.length === 0 && presentRunners.length === 0;

    const handleCloseAddNotAssignedPersonModal = () => {
        setIsOpenAddNotAssignedPersonModal(false);
        fetchData();
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex justify-between">
                    <div className="flex gap-1 items-center">
                        <PersonStanding />
                        Runners
                    </div>
                    <PlusButton
                        onClick={() => setIsOpenAddNotAssignedPersonModal(true)}
                    />
                </CardTitle>
            </CardHeader>
            <CardContent>
                {noRunners ? (
                    <h2 className="text-lg">No runners in this group</h2>
                ) : (
                    <div className="flex flex-col gap-5">
                        {absentRunners.length > 0 && (
                            <div className="flex flex-col gap-2">
                                <h2 className="font-bold text-lg">Absent</h2>
                                <AbsentPeopleList
                                    staffActivities={absentRunners}
                                    handleMarkAsPresent={handleMarkAsPresent}
                                    handleMarkAsLate={handleMarkAsLate}
                                    handleMarkAsPresentButReplaced={
                                        handleMarkAsPresentButReplaced
                                    }
                                />
                            </div>
                        )}
                        {presentRunners.length > 0 && (
                            <div className="flex flex-col gap-2">
                                <h2 className="font-bold text-lg">Present</h2>
                                <PresentPeopleList
                                    staffActivities={presentRunners}
                                    handleMarkAsAbsent={handleMarkAsAbsent}
                                />
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
            <AddNotAssignedPersonModal
                isOpen={isOpenAddNotAssignedPersonModal}
                onClose={() => handleCloseAddNotAssignedPersonModal()}
                role="RUNNER"
                groupId={groupId}
            />
        </Card>
    );
};

export default RunnersCard;
