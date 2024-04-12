import { Table, TableContainer, Tbody, Th, Thead, Tr } from "@chakra-ui/react";

import { isAdmin } from "@/logic/auth";
import { Result } from "@/logic/interfaces";
import { isMobileView } from "@/logic/utils.ts";

import ResultRow from "./ResultRow";

interface ResultsTableProps {
    results: Result[];
    maxAttempts: number;
}

const ResultsTable = ({ results, maxAttempts }: ResultsTableProps) => {
    return (
        <TableContainer>
            <Table variant="simple">
                <Thead>
                    <Tr bg="gray.400">
                        <Th>Name (ID)</Th>
                        {!isMobileView() &&
                            Array.from({ length: maxAttempts }, (_, i) => (
                                <Th width={2} key={i}>
                                    {i + 1}
                                </Th>
                            ))}
                        <Th>Average</Th>
                        <Th>Best</Th>
                        {isAdmin() && <Th>Actions</Th>}
                    </Tr>
                </Thead>
                <Tbody>
                    {results.map((result: Result) => (
                        <ResultRow
                            key={result.id}
                            result={result}
                            maxAttempts={maxAttempts}
                        />
                    ))}
                </Tbody>
            </Table>
        </TableContainer>
    );
};

export default ResultsTable;
