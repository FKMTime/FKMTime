import {
    Table,
    TableContainer,
    Tbody,
    Td,
    Text,
    Th,
    Thead,
    Tr,
} from "@chakra-ui/react";

import { DecryptedScramble } from "@/lib/interfaces";

interface ScramblesListProps {
    scrambles: DecryptedScramble[];
    roundId: string;
}

const ScramblesList = ({ scrambles, roundId }: ScramblesListProps) => {
    return (
        <TableContainer>
            <Table variant="simple">
                <Thead>
                    <TableRow bg="gray.400">
                        <TableHead>#</TableHead>
                        <TableHead>Scramble</TableHead>
                        <TableHead>Image</TableHead>
                    </TableRow>
                </Thead>
                <TableBody>
                    {scrambles.map((scramble) => (
                        <TableRow margin={0}>
                            <TableCell>
                                {scramble.isExtra ? "Extra" : null}{" "}
                                {scramble.num}{" "}
                            </TableCell>
                            <TableCell>
                                <Text
                                    as="pre"
                                    whiteSpace="pre-wrap"
                                    maxWidth="60%"
                                >
                                    {scramble.scramble}
                                </Text>
                            </TableCell>
                            <TableCell>
                                <scramble-display
                                    scramble={scramble?.scramble}
                                    event={roundId.split("-")[0]}
                                ></scramble-display>
                            </TableCell>
                        </TableRow>
                    ))}
                </Tbody>
            </Table>
        </TableContainer>
    );
};

export default ScramblesList;
