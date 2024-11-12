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
                    <Tr bg="gray.400">
                        <Th>Scramble set</Th>
                        <Th>Scrambles</Th>
                        <Th>Extra scrambles</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {scrambleSets.map((set: ScrambleSet) => (
                        <Tr key={set.id}>
                            <Td>{set.id}</Td>
                            <Td>{set.scrambles.length}</Td>
                            <Td>{set.extraScrambles.length}</Td>
                        </Tr>
                    ))}
                </Tbody>
            </Table>
        </TableContainer>
    );
};

export default ScrambleSetsTable;
