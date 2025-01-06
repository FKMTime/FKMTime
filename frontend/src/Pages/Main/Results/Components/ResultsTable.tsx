import { Table, TableContainer, Tbody, Th, TableHead, Tr } from "@chakra-ui/react";

import { isAdmin } from "@/lib/auth";
import { Result } from "@/lib/interfaces";

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
            <Table >
                <TableHead>
                    <TableRow>
                        <TableHead>Name (ID)</TableHead>
                        {Array.from({ length: maxAttempts }, (_, i) => (
                            <Th
                                width={2}
                                key={i}
                                display={{ base: "none", md: "table-cell" }}
                            >
                                {i + 1}
                            </TableHead>
                        ))}
                        <Th display={{ base: "none", md: "table-cell" }}>
                            Average
                        </TableHead>
                        <Th display={{ base: "none", md: "table-cell" }}>
                            Best
                        </TableHead>
                        {isAdmin() && <TableHead>Actions</TableHead>}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {results.map((result: Result) => (
                        <ResultRow
                            key={result.id}
                            result={result}
                            maxAttempts={maxAttempts}
                            fetchData={fetchData}
                        />
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default ResultsTable;
