import { Puzzle } from "lucide-react";
import { useMemo, useState } from "react";

import PlusButton from "@/Components/PlusButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { StaffActivity, StaffActivityStatus } from "@/lib/interfaces";

import AbsentPeopleList from "./AbsentPeopleList";
import AddNotAssignedPersonModal from "./AddNotAssignedPersonModal";
import PresentPeopleList from "./PresentPeopleList";

interface ScramblersCardProps {
    attendance: StaffActivity[];
    handleMarkAsPresent: (staffActivityId: string) => void;
    handleMarkAsAbsent: (staffActivityId: string) => void;
    handleMarkAsLate: (staffActivityId: string) => void;
    handleMarkAsPresentButReplaced: (staffActivityId: string) => void;
    fetchData: () => void;
    groupId: string;
}

const ScramblersCard = ({
    attendance,
    handleMarkAsPresent,
    handleMarkAsAbsent,
    handleMarkAsLate,
    handleMarkAsPresentButReplaced,
    fetchData,
    groupId,
}: ScramblersCardProps) => {
    const [
        isOpenAddNotAssignedPersonModal,
        setIsOpenAddNotAssignedPersonModal,
    ] = useState<boolean>(false);

    const presentScramblers = useMemo(() => {
        return attendance.filter(
            (a) =>
                a.role === "SCRAMBLER" &&
                [
                    StaffActivityStatus.PRESENT,
                    StaffActivityStatus.REPLACED,
                    StaffActivityStatus.LATE,
                ].includes(a.status)
        );
    }, [attendance]);
    const absentScramblers = useMemo(() => {
        return attendance.filter(
            (a) =>
                a.role === "SCRAMBLER" &&
                a.status === StaffActivityStatus.ABSENT
        );
    }, [attendance]);

    const noScramblers =
        absentScramblers.length === 0 && presentScramblers.length === 0;

    const handleCloseAddNotAssignedPersonModal = () => {
        setIsOpenAddNotAssignedPersonModal(false);
        fetchData();
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex justify-between">
                    <div className="flex gap-1 items-center">
                        <Puzzle />
                        Scramblers
                    </div>
                    <PlusButton
                        onClick={() => setIsOpenAddNotAssignedPersonModal(true)}
                    />
                </CardTitle>
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
                                    handleMarkAsLate={handleMarkAsLate}
                                    handleMarkAsPresentButReplaced={
                                        handleMarkAsPresentButReplaced
                                    }
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
            <AddNotAssignedPersonModal
                isOpen={isOpenAddNotAssignedPersonModal}
                onClose={() => handleCloseAddNotAssignedPersonModal()}
                role="SCRAMBLER"
                groupId={groupId}
            />
        </Card>
    );
};

export default ScramblersCard;
