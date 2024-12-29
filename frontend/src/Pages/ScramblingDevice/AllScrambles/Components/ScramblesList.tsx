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

import { DecryptedScramble } from "@/logic/interfaces";

interface ScramblesListProps {
    scrambles: DecryptedScramble[];
    roundId: string;
}

const ScramblesList = ({ scrambles, roundId }: ScramblesListProps) => {
    return (
        <TableContainer>
            <Table variant="simple">
                <Thead>
                    <Tr bg="gray.400">
                        <Th>#</Th>
                        <Th>Scramble</Th>
                        <Th>Image</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {scrambles.map((scramble) => (
                        <Tr margin={0}>
                            <Td>
                                {scramble.isExtra ? "Extra" : null}{" "}
                                {scramble.num}{" "}
                            </Td>
                            <Td>
                                <Text
                                    as="pre"
                                    whiteSpace="pre-wrap"
                                    maxWidth="60%"
                                >
                                    {scramble.scramble}
                                </Text>
                            </Td>
                            <Td>
                                <scramble-display
                                    scramble={scramble?.scramble}
                                    event={roundId.split("-")[0]}
                                ></scramble-display>
                            </Td>
                        </Tr>
                    ))}
                </Tbody>
            </Table>
        </TableContainer>
    );
};

export default ScramblesList;
