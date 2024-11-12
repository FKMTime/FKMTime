import { Table, TableContainer, Tbody, Th, Thead, Tr } from "@chakra-ui/react";

import { ScrambleSet } from "@/logic/interfaces";

import ScrambleSetRow from "./ScrambleSetRow";

interface ScrambleSetsTableProps {
    scrambleSets: ScrambleSet[];
    fetchData: (roundId?: string) => void;
}

const ScrambleSetsTable = ({
    scrambleSets,
    fetchData,
}: ScrambleSetsTableProps) => {
    return (
        <TableContainer>
            <Table variant="simple">
                <Thead>
                    <Tr bg="gray.400">
                        <Th>Name</Th>
                        <Th>Scrambles</Th>
                        <Th>Extra scrambles</Th>
                        <Th>Actions</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {scrambleSets.map((set) => (
                        <ScrambleSetRow
                            key={set.id}
                            scrambleSet={set}
                            fetchData={fetchData}
                        />
                    ))}
                </Tbody>
            </Table>
        </TableContainer>
    );
};

export default ScrambleSetsTable;
