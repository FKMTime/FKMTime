import { Table, TableContainer, Tbody, Th, Thead, Tr } from "@chakra-ui/react";

import { Incident } from "@/logic/interfaces";

import ResultsCheckRow from "./ResultsCheckRow";

interface ResultsChecksTableProps {
    checks: Incident[];
}

const ResultsChecksTable = ({ checks }: ResultsChecksTableProps) => {
    return (
        <TableContainer>
            <Table variant="simple">
                <Thead>
                    <Tr bg="gray.400">
                        <Th>Person</Th>
                        <Th>Round</Th>
                        <Th>Attempt</Th>
                        <Th>Time</Th>
                        <Th>Comment</Th>
                        <Th>Judge</Th>
                        <Th>Warnings</Th>
                        <Th>Actions</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {checks.map((item) => (
                        <ResultsCheckRow key={item.id} check={item} />
                    ))}
                </Tbody>
            </Table>
        </TableContainer>
    );
};

export default ResultsChecksTable;
