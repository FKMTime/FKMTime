import { Table, TableContainer, Tbody, Th, Thead, Tr } from "@chakra-ui/react";
import { Attempt } from "../../logic/interfaces";
import AttemptRow from "./Row/AttemptRow";

interface AttemptsTableProps {
    attempts: Attempt[];
    showExtraColumns?: boolean;
    fetchData: () => void;
}

const AttemptsTable: React.FC<AttemptsTableProps> = ({ attempts, showExtraColumns = false, fetchData }): JSX.Element => {
    return (
        <TableContainer>
            <Table variant='simple'>
                <Thead>
                    <Tr bg='gray.400'>
                        <Th>No</Th>
                        <Th>Attempt number</Th>
                        <Th>Time</Th>
                        {showExtraColumns && (
                            <>
                        <Th>Replaced by</Th>
                        <Th>Case</Th>
                        </>
                        )}
                        <Th>Judge</Th>
                        <Th>Station</Th>
                        <Th>Solved at</Th>
                        <Th>Actions</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {attempts.map((attempt: Attempt, i: number) => (
                        <AttemptRow key={attempt.id} attempt={attempt} showExtraColumns={showExtraColumns} fetchData={fetchData} no={i + 1} />
                    ))}
                </Tbody>
            </Table>
        </TableContainer>
    )
};

export default AttemptsTable;
