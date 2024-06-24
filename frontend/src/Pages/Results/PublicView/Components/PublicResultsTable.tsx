import { Table, TableContainer, Tbody, Th, Thead, Tr } from "@chakra-ui/react";

import { ResultWithAverage } from "@/logic/interfaces";
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
            <Table variant="simple">
                <Thead>
                    <Tr bg="gray.400">
                        <Th>Pos</Th>
                        <Th>Name</Th>
                        {!isMobileView() &&
                            Array.from({ length: maxAttempts }, (_, i) => (
                                <Th width={2} key={i}>
                                    {i + 1}
                                </Th>
                            ))}
                        <Th>Average</Th>
                        <Th>Best</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {results.map((result: ResultWithAverage, i: number) => (
                        <PublicResultRow
                            key={result.id}
                            result={result}
                            maxAttempts={maxAttempts}
                            pos={i + 1}
                        />
                    ))}
                </Tbody>
            </Table>
        </TableContainer>
    );
};

export default PublicResultsTable;
