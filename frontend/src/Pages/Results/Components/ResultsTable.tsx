import { Table, TableContainer, Tbody, Th, Thead, Tr } from "@chakra-ui/react";

import { isAdmin } from "@/logic/auth";
import { Result } from "@/logic/interfaces";

import ResultRow from "./ResultRow";

interface ResultsTableProps {
    results: Result[];
    maxAttempts: number;
    fetchData: (roundId: string, searchParam?: string) => void;
}

const ResultsTable = ({
    results,
    maxAttempts,
    fetchData,
}: ResultsTableProps) => {
    return (
        <TableContainer>
            <Table variant="simple">
                <Thead>
                    <Tr bg="gray.400">
                        <Th>Name (ID)</Th>
                        {Array.from({ length: maxAttempts }, (_, i) => (
                            <Th
                                width={2}
                                key={i}
                                display={{ base: "none", md: "table-cell" }}
                            >
                                {i + 1}
                            </Th>
                        ))}
                        <Th display={{ base: "none", md: "table-cell" }}>
                            Average
                        </Th>
                        <Th display={{ base: "none", md: "table-cell" }}>
                            Best
                        </Th>
                        {isAdmin() && <Th>Actions</Th>}
                    </Tr>
                </Thead>
                <Tbody>
                    {results.map((result: Result) => (
                        <ResultRow
                            key={result.id}
                            result={result}
                            maxAttempts={maxAttempts}
                            fetchData={fetchData}
                        />
                    ))}
                </Tbody>
            </Table>
        </TableContainer>
    );
};

export default ResultsTable;
