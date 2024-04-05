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
import { Competition } from "@wca/helpers";
import { useEffect, useState } from "react";

import { Modal } from "@/Components/Modal";
import { getAssigmentsList } from "@/logic/activities";
import { getAttendanceByPersonId, wasPresent } from "@/logic/attendance";
import { Attendance, Person } from "@/logic/interfaces";

interface DisplayGroupsModalProps {
    isOpen: boolean;
    onClose: () => void;
    person: Person;
    wcif: Competition;
}

const DisplayGroupsModal = ({
    isOpen,
    onClose,
    wcif,
    person,
}: DisplayGroupsModalProps) => {
    const assignments = person.registrantId
        ? getAssigmentsList(person.registrantId, wcif)
        : [];
    const [attendance, setAttendance] = useState<Attendance[]>([]);

    useEffect(() => {
        if (person.registrantId && isOpen) {
            getAttendanceByPersonId(person.id).then((data) => {
                setAttendance(data);
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
                            </Tr>
                        </Thead>
                        <Tbody>
                            {assignments.map((assignment) => (
                                <Tr key={assignment.activityCode}>
                                    <Td>{assignment.groupName}</Td>
                                    <Td>{assignment.activityName}</Td>
                                    <Td>
                                        {attendance &&
                                        assignment.activityName !== "Competitor"
                                            ? wasPresent(
                                                  attendance,
                                                  assignment.activityCode,
                                                  assignment.activityName
                                              )
                                            : ""}
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
