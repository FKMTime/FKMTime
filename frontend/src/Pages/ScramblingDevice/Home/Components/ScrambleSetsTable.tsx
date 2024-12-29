import {
    Button,
    Table,
    TableContainer,
    Tbody,
    Td,
    Th,
    Thead,
    Tr,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";

import { activityCodeToName } from "@/logic/activities";
import { ScrambleSet } from "@/logic/interfaces";

interface ScrambleSetsTableProps {
    scrambleSets: ScrambleSet[];
}

const ScrambleSetsTable = ({ scrambleSets }: ScrambleSetsTableProps) => {
    const navigate = useNavigate();
    return (
        <TableContainer>
            <Table variant="simple">
                <Thead>
                    <Tr bg="gray.400">
                        <Th>Name</Th>
                        <Th>Actions</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {scrambleSets.map((scrambleSet) => (
                        <Tr key={scrambleSet.id}>
                            <Td>
                                {activityCodeToName(scrambleSet.roundId)} Set{" "}
                                {scrambleSet.set}
                            </Td>
                            <Td display="flex" gap="2">
                                <Button
                                    onClick={() =>
                                        navigate(
                                            `/scrambling-device/set/${scrambleSet.id}`
                                        )
                                    }
                                    colorScheme="yellow"
                                >
                                    Scramble
                                </Button>
                                <Button
                                    onClick={() =>
                                        navigate(
                                            `/scrambling-device/set/${scrambleSet.id}/scrambles`
                                        )
                                    }
                                    colorScheme="blue"
                                >
                                    All scrambles
                                </Button>
                            </Td>
                        </Tr>
                    ))}
                </Tbody>
            </Table>
        </TableContainer>
    );
};

export default ScrambleSetsTable;
