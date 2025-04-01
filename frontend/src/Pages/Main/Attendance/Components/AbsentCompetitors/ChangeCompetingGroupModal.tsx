import { useAtomValue } from "jotai";
import { useMemo, useState } from "react";

import { Modal } from "@/Components/Modal";
import ModalActions from "@/Components/ModalActions";
import { Alert, AlertTitle } from "@/Components/ui/alert";
import { Button } from "@/Components/ui/button";
import { Label } from "@/Components/ui/label";
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
import { competitionAtom } from "@/lib/atoms";
import { StaffActivity } from "@/lib/interfaces";
import { changeCompetingGroup } from "@/lib/persons";

interface ChangeCompetingGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    activity: StaffActivity;
}

const ChangeCompetingGroupModal = ({
    isOpen,
    onClose,
    activity,
}: ChangeCompetingGroupModalProps) => {
    const { toast } = useToast();
    const confirm = useConfirm();
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [newGroup, setNewGroup] = useState<string>("");
    const competition = useAtomValue(competitionAtom);

    const groups = useMemo(() => {
        if (!competition) return [];
        return getGroupsByRoundId(
            activity.groupId.split("-g")[0],
            competition.wcif
        ).filter((g) => g.activityCode !== activity.groupId);
    }, [activity.groupId, competition]);

    const handleSubmit = () => {
        setIsLoading(true);
        confirm({
            title: `Are you sure you want to move that competitor to the ${activityCodeToName(newGroup)}?`,
            description: `If the competitor has any other asssignments during ${activityCodeToName(newGroup)} they will be deleted.`,
        })
            .then(async () => {
                const status = await changeCompetingGroup(
                    activity.person.id,
                    newGroup
                );
                if (status === 200) {
                    toast({
                        title: "Succesfully moved the competitor to another group",
                        variant: "success",
                    });
                    setIsLoading(false);
                    onClose();
                } else {
                    toast({
                        title: "Something went wrong!",
                        variant: "destructive",
                    });
                }
            })
            .catch(() => {
                toast({
                    title: "Moving competitor was cancelled",
                });
            });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Move the competitor to another group"
        >
            <Alert variant="warning">
                <AlertTitle>
                    This change will also be reflected in the WCIF, you need to
                    have permissions to sync in order to change group.
                </AlertTitle>
            </Alert>
            Current group: {activityCodeToName(activity.groupId)}
            <div>
                <Label>New group</Label>
                <Select
                    value={newGroup}
                    onValueChange={(value) => setNewGroup(value)}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select new group" />
                    </SelectTrigger>
                    <SelectContent>
                        {groups.map((group) => (
                            <SelectItem
                                value={group.activityCode}
                                key={group.id}
                            >
                                {activityCodeToName(group.activityCode)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <ModalActions>
                <Button
                    variant="success"
                    onClick={handleSubmit}
                    disabled={isLoading}
                >
                    Submit
                </Button>
            </ModalActions>
        </Modal>
    );
};

export default ChangeCompetingGroupModal;
