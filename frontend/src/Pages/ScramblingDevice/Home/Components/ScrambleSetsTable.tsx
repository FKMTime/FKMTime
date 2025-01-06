import {
    Button,
    Table,
    TableContainer,
    Tbody,
    Td,
    Th,
    TableHead,
    Tr,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";

import { activityCodeToName } from "@/lib/activities";
import { ScrambleSet } from "@/lib/interfaces";

interface ScrambleSetsTableProps {
    scrambleSets: ScrambleSet[];
}

const ScrambleSetsTable = ({ scrambleSets }: ScrambleSetsTableProps) => {
    const navigate = useNavigate();
    return (
        <TableContainer>
            <Table >
                <TableHead>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Actions</TableHead>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {scrambleSets.map((scrambleSet) => (
                        <TableRow key={scrambleSet.id}>
                            <TableCell>
                                {activityCodeToName(scrambleSet.roundId)} Set{" "}
                                {scrambleSet.set}
                            </TableCell>
                            <TableCell display="flex" gap="2">
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
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default ScrambleSetsTable;
