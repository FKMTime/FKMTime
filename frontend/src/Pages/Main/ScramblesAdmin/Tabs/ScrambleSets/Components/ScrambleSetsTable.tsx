import { Table, TableContainer, Tbody, Th, Thead, Tr } from "@chakra-ui/react";

import { ScrambleSet } from "@/lib/interfaces";

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
                    <TableRow bg="gray.400">
                        <TableHead>Name</TableHead>
                        <TableHead>Scrambles</TableHead>
                        <TableHead>Extra scrambles</TableHead>
                        <TableHead>Actions</TableHead>
                    </TableRow>
                </Thead>
                <TableBody>
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
