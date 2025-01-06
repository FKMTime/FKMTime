import {
    Box,
    Button,
    FormControl,
    FormLabel,
    Heading,
    Select,
    UnorderedList,
    useToast,
} from "@chakra-ui/react";
import { Activity, Competition as WCIF } from "@wca/helpers";
import { useConfirm } from "chakra-ui-confirm";
import { useState } from "react";

import { Modal } from "@/Components/Modal";
import { activityCodeToName, getGroupsByRoundId } from "@/lib/activities";
import { getAttendanceByGroupId } from "@/lib/attendance";
import { StaffActivity } from "@/lib/interfaces";
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
    const confirm = useConfirm();
    const toast = useToast();
    const [selectedGroup, setSelectedGroup] = useState<string>("");
    const groups = getGroupsByRoundId(roundId, wcif);
    const groupName = activityCodeToName(selectedGroup);
    const [competitors, setCompetitors] = useState<StaffActivity[]>([]);

    const handleSelectGroup = async (id: string) => {
        setSelectedGroup(id);
        const attendanceData = await getAttendanceByGroupId(id);
        const alreadyCompeted = attendanceData.filter(
            (activity: StaffActivity) =>
                activity.isPresent && activity.role === "COMPETITOR"
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
                    status: "info",
                });
            });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                selectedGroup
                    ? `Restart ${groupName}`
                    : "Select group to restart"
            }
        >
            <Box display="flex" flexDirection="column" gap="5">
                <FormControl width="fit-content">
                    <FormLabel>Group</FormLabel>
                    <Select
                        value={selectedGroup}
                        onChange={(event) =>
                            handleSelectGroup(event.target.value)
                        }
                        placeholder="Select group"
                    >
                        {groups.map((group: Activity, i: number) => (
                            <option
                                key={group.activityCode}
                                value={group.activityCode}
                            >
                                {i + 1}
                            </option>
                        ))}
                    </Select>
                </FormControl>
                {selectedGroup && (
                    <>
                        <Heading size="md">
                            All results for this competitors will be deleted:
                        </Heading>
                        <UnorderedList spacing="3">
                            {competitors.map((competitor: StaffActivity) => (
                                <li key={competitor.person.id}>
                                    {competitor.person.name}
                                </li>
                            ))}
                        </UnorderedList>
                    </>
                )}
                <Button colorScheme="red" onClick={handleRestartGroup}>
                    Restart group
                </Button>
            </Box>
        </Modal>
    );
};

export default RestartGroupModal;
