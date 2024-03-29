import { Table, TableContainer, Tbody, Th, Thead, Tr } from "@chakra-ui/react";

import { HAS_WRITE_ACCESS } from "@/logic/accounts";
import { getUserInfo } from "@/logic/auth";
import { Result } from "@/logic/interfaces";

import ResultRow from "./ResultRow";

interface ResultsTableProps {
    results: Result[];
    maxAttempts: number;
}

const ResultsTable = ({ results, maxAttempts }: ResultsTableProps) => {
    const userInfo = getUserInfo();
    return (
        <TableContainer>
            <Table variant="simple">
                <Thead>
                    <Tr bg="gray.400">
                        <Th>Name (ID)</Th>
                        {Array.from({ length: maxAttempts }, (_, i) => (
                            <Th width={2} key={i}>
                                {i + 1}
                            </Th>
                        ))}
                        <Th>Average</Th>
                        <Th>Best</Th>
                        {HAS_WRITE_ACCESS.includes(userInfo.role) && (
                            <Th>Actions</Th>
                        )}
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
