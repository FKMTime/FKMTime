import { Table, TableContainer, Tbody, Th, Thead, Tr } from "@chakra-ui/react";

import { isAdmin } from "@/lib/auth";
import { Result } from "@/lib/interfaces";

import PersonResultRow from "./PersonResultRow";

interface PersonResultsTableProps {
    results: Result[];
}

const PersonResultsTable = ({ results }: PersonResultsTableProps) => {
    return (
        <TableContainer>
            <Table variant="simple">
                <Thead>
                    <TableRow bg="gray.400">
                        <TableHead>Round</TableHead>
                        <TableHead>Average</TableHead>
                        <TableHead>Best</TableHead>
                        {isAdmin() && <TableHead>Actions</TableHead>}
                    </TableRow>
                </Thead>
                <TableBody>
                    {results.map((result: Result) => (
                        <PersonResultRow key={result.id} result={result} />
                    ))}
                </Tbody>
            </Table>
        </TableContainer>
    );
};

export default PersonResultsTable;
