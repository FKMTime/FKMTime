import { Table, TableContainer, Tbody, Th, TableHead, Tr } from "@chakra-ui/react";

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
            <Table >
                <TableHead>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Scrambles</TableHead>
                        <TableHead>Extra scrambles</TableHead>
                        <TableHead>Actions</TableHead>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {scrambleSets.map((set) => (
                        <ScrambleSetRow
                            key={set.id}
                            scrambleSet={set}
                            fetchData={fetchData}
                        />
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default ScrambleSetsTable;
