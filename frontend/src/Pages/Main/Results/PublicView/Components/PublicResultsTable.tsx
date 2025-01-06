import { Table, TableContainer, Tbody, Th, TableHead, Tr } from "@chakra-ui/react";

import { ResultWithAverage } from "@/lib/interfaces";
import { isMobileView } from "@/logic/utils.ts";

import PublicResultRow from "./PublicResultRow";

interface PublicResultsTableProps {
    results: ResultWithAverage[];
    maxAttempts: number;
}

const PublicResultsTable = ({
    results,
    maxAttempts,
}: PublicResultsTableProps) => {
    return (
        <TableContainer>
            <Table >
                <TableHead>
                    <TableRow>
                        <TableHead>Pos</TableHead>
                        <TableHead>Name</TableHead>
                        {!isMobileView() &&
                            Array.from({ length: maxAttempts }, (_, i) => (
                                <Th width={2} key={i}>
                                    {i + 1}
                                </TableHead>
                            ))}
                        <TableHead>Average</TableHead>
                        <TableHead>Best</TableHead>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {results.map((result: ResultWithAverage, i: number) => (
                        <PublicResultRow
                            key={result.id}
                            result={result}
                            maxAttempts={maxAttempts}
                            pos={i + 1}
                        />
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default PublicResultsTable;
