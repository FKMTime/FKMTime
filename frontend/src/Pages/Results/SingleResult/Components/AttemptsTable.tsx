import { Table, TableContainer, Tbody, Th, Thead, Tr } from "@chakra-ui/react";

import { Attempt, Result } from "@/logic/interfaces";

import AttemptRow from "./AttemptRow";

interface AttemptsTableProps {
    attempts: Attempt[];
    result: Result;
    showExtraColumns?: boolean;
    fetchData: () => void;
}

const AttemptsTable = ({
    attempts,
    showExtraColumns = false,
    fetchData,
    result,
}: AttemptsTableProps) => {
    return (
        <TableContainer>
            <Table variant="simple">
                <Thead>
                    <Tr bg="gray.400">
                        <Th>No</Th>
                        <Th>Attempt number</Th>
                        <Th>Time</Th>
                        {showExtraColumns && (
                            <>
                                <Th>Replaced by</Th>
                                <Th>Status</Th>
                            </>
                        )}
                        <Th>Judge</Th>
                        <Th>Station</Th>
                        <Th>Comment</Th>
                        <Th>Solved at</Th>
                        <Th>Actions</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {attempts.map((attempt: Attempt, i: number) => (
                        <AttemptRow
                            key={attempt.id}
                            attempt={attempt}
                            showExtraColumns={showExtraColumns}
                            fetchData={fetchData}
                            no={i + 1}
                            result={result}
                        />
                    ))}
                </Tbody>
            </Table>
        </TableContainer>
    );
};

export default AttemptsTable;
