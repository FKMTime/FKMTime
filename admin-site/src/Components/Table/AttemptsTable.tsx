import { Table, TableContainer, Tbody, Th, Thead, Tr } from "@chakra-ui/react";
import { Attempt } from "../../logic/interfaces";
import AttemptRow from "./Row/AttemptRow";

interface AttemptsTableProps {
    attempts: Attempt[];
    showExtraColumns?: boolean;
}

const AttemptsTable: React.FC<AttemptsTableProps> = ({ attempts, showExtraColumns = false }): JSX.Element => {
    console.log(attempts);
    return (
        <TableContainer>
            <Table variant='simple'>
                <Thead>
                    <Tr bg='gray.400'>
                        <Th>Attempt number</Th>
                        <Th>Time</Th>
                        <Th>Is extra attempt</Th>
                        {showExtraColumns && (
                            <>
                        <Th>Replaced by/Replacement of</Th>
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
                    {attempts.map((attempt: Attempt) => (
                        <AttemptRow key={attempt.id} attempt={attempt} showExtraColumns={showExtraColumns} />
                    ))}
                </Tbody>
            </Table>
        </TableContainer>
    )
};

export default AttemptsTable;
