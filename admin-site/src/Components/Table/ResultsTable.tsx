import { Table, TableContainer, Tbody, Th, Thead, Tr } from "@chakra-ui/react";
import { Result } from "../../logic/interfaces";
import ResultRow from "./Row/ResultRow";
import {getUserInfo} from "../../logic/auth.ts";
import {HAS_WRITE_ACCESS} from "../../logic/accounts.ts";

interface ResultsTableProps {
    results: Result[];
}

const ResultsTable: React.FC<ResultsTableProps> = ({ results }): JSX.Element => {
    const userInfo = getUserInfo();
    return (
        <TableContainer>
            <Table variant='simple'>
                <Thead>
                    <Tr bg='gray.400'>
                        <Th>Registrant ID</Th>
                        <Th>Name</Th>
                        <Th>WCA ID</Th>
                        {HAS_WRITE_ACCESS.includes(userInfo.role) && <Th>Attempts</Th>}
                    </Tr>
                </Thead>
                <Tbody>
                    {results.map((result: Result) => (
                        <ResultRow key={result.id} result={result} />
                    ))}
                </Tbody>
            </Table>
        </TableContainer>
    )
};

export default ResultsTable;
