import { Table, TableContainer, Tbody, Th, Thead, Tr } from "@chakra-ui/react";

import { isAdmin } from "@/logic/auth";
import { Result } from "@/logic/interfaces";

import PersonResultRow from "./PersonResultRow";

interface PersonResultsTableProps {
    results: Result[];
}

const PersonResultsTable = ({ results }: PersonResultsTableProps) => {
    return (
        <TableContainer>
            <Table variant="simple">
                <Thead>
                    <Tr bg="gray.400">
                        <Th>Round</Th>
                        <Th>Average</Th>
                        <Th>Best</Th>
                        {isAdmin() && <Th>Actions</Th>}
                    </Tr>
                </Thead>
                <Tbody>
                    {results.map((result: Result) => (
                        <PersonResultRow key={result.id} result={result} />
                    ))}
                </Tbody>
            </Table>
        </TableContainer>
    );
};

export default PersonResultsTable;
