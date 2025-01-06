import {
    Box,
    Table,
    TableContainer,
    Tbody,
    Td,
    Th,
    Thead,
    Tr,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";

import { Modal } from "@/Components/Modal";
import { activityCodeToName, prettyActivityName } from "@/lib/activities";
import { getStaffActivitiesByPersonId } from "@/lib/attendance";
import { Person, StaffActivity } from "@/lib/interfaces";

interface DisplayGroupsModalProps {
    isOpen: boolean;
    onClose: () => void;
    person: Person;
}

const DisplayGroupsModal = ({
    isOpen,
    onClose,
    person,
}: DisplayGroupsModalProps) => {
    const [staffActivity, setStaffActivity] = useState<StaffActivity[]>([]);

    useEffect(() => {
        if (person.registrantId && isOpen) {
            getStaffActivitiesByPersonId(person.id).then((data) => {
                setStaffActivity(data);
            });
        }
    }, [isOpen, person.id, person.registrantId]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Groups">
            <Box display="flex" flexDirection="column" gap="5">
                <TableContainer>
                    <Table variant="simple">
                        <Thead>
                            <TableRow bg="gray.400">
                                <TableHead>Group</TableHead>
                                <TableHead>Activity</TableHead>
                                <TableHead>Was present</TableHead>
                                <TableHead>Is assigned</TableHead>
                            </TableRow>
                        </Thead>
                        <TableBody>
                            {staffActivity.map((activity) => (
                                <TableRow key={activity.id}>
                                    <TableCell>
                                        {activityCodeToName(activity.groupId)}
                                    </TableCell>
                                    <TableCell>{prettyActivityName(activity.role)}</TableCell>
                                    <TableCell>{activity.isPresent ? "Yes" : "No"}</TableCell>
                                    <TableCell>
                                        {activity.isAssigned ? "Yes" : "No"}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </Tbody>
                    </Table>
                </TableContainer>
            </Box>
        </Modal>
    );
};

export default DisplayGroupsModal;
