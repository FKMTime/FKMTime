import { Table, TableContainer, Tbody, Th, Thead, Tr } from "@chakra-ui/react";

import { Incident } from "@/logic/interfaces.ts";

import ResolvedIncidentRow from "./ResolvedIncidentRow";

interface ResolvedIncidentsTableProps {
    data: Incident[];
}

const ResolvedIncidents = ({ data }: ResolvedIncidentsTableProps) => {
    return (
        <TableContainer>
            <Table variant="simple">
                <Thead>
                    <Tr bg="gray.400">
                        <Th>Person</Th>
                        <Th>Round</Th>
                        <Th>Attempt</Th>
                        <Th>Time</Th>
                        <Th>Solved at</Th>
                        <Th>Updated by</Th>
                        <Th>Status</Th>
                        <Th>Comment</Th>
                        <Th>Judge</Th>
                        <Th>Actions</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {data.map((incident) => (
                        <ResolvedIncidentRow
                            key={incident.id}
                            incident={incident}
                        />
                    ))}
                </Tbody>
            </Table>
        </TableContainer>
    );
};

export default ResolvedIncidents;
