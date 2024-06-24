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
import { activityCodeToName, prettyActivityName } from "@/logic/activities";
import { getStaffActivitiesByPersonId } from "@/logic/attendance";
import { Person, StaffActivity } from "@/logic/interfaces";

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
                            <Tr bg="gray.400">
                                <Th>Group</Th>
                                <Th>Activity</Th>
                                <Th>Was present</Th>
                                <Th>Is assigned</Th>
                            </Tr>
                        </Thead>
                        <Tbody>
                            {staffActivity.map((activity) => (
                                <Tr key={activity.id}>
                                    <Td>
                                        {activityCodeToName(activity.groupId)}
                                    </Td>
                                    <Td>{prettyActivityName(activity.role)}</Td>
                                    <Td>{activity.isPresent ? "Yes" : "No"}</Td>
                                    <Td>
                                        {activity.isAssigned ? "Yes" : "No"}
                                    </Td>
                                </Tr>
                            ))}
                        </Tbody>
                    </Table>
                </TableContainer>
            </Box>
        </Modal>
    );
};

export default DisplayGroupsModal;
