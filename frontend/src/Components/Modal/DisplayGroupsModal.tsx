import {
    Box,
    TableContainer,
    Table,
    Thead,
    Tr,
    Th,
    Tbody,
    Td,
} from "@chakra-ui/react";
import { getAssigmentsList } from "../../logic/activities";
import { Modal } from "./Modal";
import { Competition } from "@wca/helpers";
import { Attendance, Person } from "../../logic/interfaces.ts";
import { useEffect, useState } from "react";
import { getAttendanceByPersonId, wasPresent } from "../../logic/attendance.ts";

interface DisplayGroupsModalProps {
    isOpen: boolean;
    onClose: () => void;
    person: Person;
    wcif: Competition;
}

const DisplayGroupsModal: React.FC<DisplayGroupsModalProps> = ({
    isOpen,
    onClose,
    wcif,
    person,
}): JSX.Element => {
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
                                        {attendance
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
