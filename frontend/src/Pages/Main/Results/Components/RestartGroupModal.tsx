import { Activity, Competition as WCIF } from "@wca/helpers";
import { useState } from "react";
import { Label } from "recharts";

import { Modal } from "@/Components/Modal";
import ModalActions from "@/Components/ModalActions";
import { Button } from "@/Components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName, getGroupsByRoundId } from "@/lib/activities";
import { getAttendanceByGroupId } from "@/lib/attendance";
import { StaffActivity, StaffActivityStatus } from "@/lib/interfaces";
import { restartGroup } from "@/lib/results";

interface RestartGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    roundId: string;
    wcif: WCIF;
}

const RestartGroupModal = ({
    isOpen,
    onClose,
    roundId,
    wcif,
}: RestartGroupModalProps) => {
    const { toast } = useToast();
    const confirm = useConfirm();
    const [selectedGroup, setSelectedGroup] = useState<string>("");
    const groups = getGroupsByRoundId(roundId, wcif);
    const groupName = activityCodeToName(selectedGroup);
    const [competitors, setCompetitors] = useState<StaffActivity[]>([]);

    const handleSelectGroup = async (id: string) => {
        setSelectedGroup(id);
        const attendanceData = await getAttendanceByGroupId(id);
        const alreadyCompeted = attendanceData.filter(
            (activity: StaffActivity) =>
                activity.status === StaffActivityStatus.PRESENT &&
                activity.role === "COMPETITOR"
        );
        setCompetitors(alreadyCompeted);
    };

    const handleRestartGroup = () => {
        confirm({
            title: `Are you sure you want to restart ${groupName}?`,
            description:
                "All results from this group will be deleted, attendance will be cleared",
        })
            .then(async () => {
                const status = await restartGroup(selectedGroup);
                if (status === 204) {
                    toast({
                        title: "Group restarted",
                        variant: "success",
                    });
                    onClose();
                } else {
                    toast({
                        title: "Something went wrong",
                        variant: "destructive",
                    });
                }
            })
            .catch(() => {
                toast({
                    title: "Group not restarted",
                });
            });
    };

    const handleClose = () => {
        setSelectedGroup("");
        setCompetitors([]);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={
                selectedGroup
                    ? `Restart ${groupName}`
                    : "Select group to restart"
            }
        >
            <div className="flex flex-col gap-5">
                <div>
                    <Label>Group</Label>
                    <div className="w-fit">
                        <Select
                            value={selectedGroup}
                            onValueChange={(value) => handleSelectGroup(value)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select group" />
                            </SelectTrigger>
                            <SelectContent>
                                {groups.map((group: Activity, i: number) => (
                                    <SelectItem
                                        key={group.activityCode}
                                        value={group.activityCode}
                                    >
                                        Group {i + 1}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                {selectedGroup && (
                    <div className="overflow-y-auto max-h-96">
                        <h2 className="text-lg">
                            All results for this competitors will be deleted:
                        </h2>
                        <ul className="list-disc pl-5">
                            {competitors.map((competitor: StaffActivity) => (
                                <li key={competitor.person.id}>
                                    {competitor.person.name}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                <ModalActions>
                    <Button variant="destructive" onClick={handleRestartGroup}>
                        Restart group
                    </Button>
                </ModalActions>
            </div>
        </Modal>
    );
};

export default RestartGroupModal;
