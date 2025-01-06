import { Table, TableContainer, Tbody, Th, TableHead, Tr } from "@chakra-ui/react";

import { Incident } from "@/lib/interfaces";

import ResultsCheckRow from "./ResultsCheckRow";

interface ResultsChecksTableProps {
    checks: Incident[];
}

const ResultsChecksTable = ({ checks }: ResultsChecksTableProps) => {
    return (
        <TableContainer>
            <Table >
                <TableHead>
                    <TableRow>
                        <TableHead>Person</TableHead>
                        <TableHead>Round</TableHead>
                        <TableHead>Attempt</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Comment</TableHead>
                        <TableHead>Judge</TableHead>
                        <TableHead>Warnings</TableHead>
                        <TableHead>Actions</TableHead>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {checks.map((item) => (
                        <ResultsCheckRow key={item.id} check={item} />
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default ResultsChecksTable;
