import { Table, TableContainer, Tbody, Th, Thead, Tr } from "@chakra-ui/react";
import { Competition } from "@wca/helpers";

import { HAS_WRITE_ACCESS } from "@/logic/accounts";
import { getUserInfo } from "@/logic/auth";
import { Result } from "@/logic/interfaces";

import PersonResultRow from "./PersonResultRow";

interface PersonResultsTableProps {
    results: Result[];
    wcif: Competition;
}

const PersonResultsTable = ({ results, wcif }: PersonResultsTableProps) => {
    const userInfo = getUserInfo();
    return (
        <TableContainer>
            <Table variant="simple">
                <Thead>
                    <Tr bg="gray.400">
                        <Th>Round</Th>
                        <Th>Average</Th>
                        <Th>Best</Th>
                        {HAS_WRITE_ACCESS.includes(userInfo.role) && (
                            <Th>Actions</Th>
                        )}
                    </Tr>
                </Thead>
                <Tbody>
                    {results.map((result: Result) => (
                        <PersonResultRow
                            key={result.id}
                            result={result}
                            wcif={wcif}
                        />
                    ))}
                </Tbody>
            </Table>
        </TableContainer>
    );
};

export default PersonResultsTable;