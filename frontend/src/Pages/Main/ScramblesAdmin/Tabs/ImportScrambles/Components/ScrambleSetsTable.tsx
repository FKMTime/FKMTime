import {
    Table,
    TableContainer,
    Tbody,
    Td,
    Th,
    Thead,
    Tr,
} from "@chakra-ui/react";
import { ScrambleSet } from "@wca/helpers";

interface ScrambleSetsTableProps {
    scrambleSets: ScrambleSet[];
}

const ScrambleSetsTable = ({ scrambleSets }: ScrambleSetsTableProps) => {
    return (
        <TableContainer>
            <Table variant="simple">
                <Thead>
                    <TableRow bg="gray.400">
                        <TableHead>Scramble set</TableHead>
                        <TableHead>Scrambles</TableHead>
                        <TableHead>Extra scrambles</TableHead>
                    </TableRow>
                </Thead>
                <TableBody>
                    {scrambleSets.map((set: ScrambleSet) => (
                        <TableRow key={set.id}>
                            <TableCell>{set.id}</TableCell>
                            <TableCell>{set.scrambles.length}</TableCell>
                            <TableCell>{set.extraScrambles.length}</TableCell>
                        </TableRow>
                    ))}
                </Tbody>
            </Table>
        </TableContainer>
    );
};

export default ScrambleSetsTable;
