import { Table, TableContainer, Tbody, Th, Thead, Tr } from "@chakra-ui/react";

import { Incident } from "@/lib/interfaces";

import ResultsCheckRow from "./ResultsCheckRow";

interface ResultsChecksTableProps {
    checks: Incident[];
}

const ResultsChecksTable = ({ checks }: ResultsChecksTableProps) => {
    return (
        <TableContainer>
            <Table variant="simple">
                <Thead>
                    <TableRow bg="gray.400">
                        <TableHead>Person</TableHead>
                        <TableHead>Round</TableHead>
                        <TableHead>Attempt</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Comment</TableHead>
                        <TableHead>Judge</TableHead>
                        <TableHead>Warnings</TableHead>
                        <TableHead>Actions</TableHead>
                    </TableRow>
                </Thead>
                <TableBody>
                    {checks.map((item) => (
                        <ResultsCheckRow key={item.id} check={item} />
                    ))}
                </Tbody>
            </Table>
        </TableContainer>
    );
};

export default ResultsChecksTable;
