import {
    Table,
    TableContainer,
    Tbody,
    Td,
    Th,
    TableHead,
    Tr,
} from "@chakra-ui/react";
import { ScrambleSet } from "@wca/helpers";

interface ScrambleSetsTableProps {
    scrambleSets: ScrambleSet[];
}

const ScrambleSetsTable = ({ scrambleSets }: ScrambleSetsTableProps) => {
    return (
        <TableContainer>
            <Table >
                <TableHead>
                    <TableRow>
                        <TableHead>Scramble set</TableHead>
                        <TableHead>Scrambles</TableHead>
                        <TableHead>Extra scrambles</TableHead>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {scrambleSets.map((set: ScrambleSet) => (
                        <TableRow key={set.id}>
                            <TableCell>{set.id}</TableCell>
                            <TableCell>{set.scrambles.length}</TableCell>
                            <TableCell>{set.extraScrambles.length}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default ScrambleSetsTable;
