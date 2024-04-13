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

import { WCACompetition } from "@/logic/interfaces.ts";

interface CompetitionsListProps {
    competitions: WCACompetition[];
    handleImportCompetition: (wcaId: string) => void;
}

const CompetitionsList = ({
    competitions,
    handleImportCompetition,
}: CompetitionsListProps) => {
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
                    {competitions.map((competition) => (
                        <Tr>
                            <Td>{competition.name}</Td>
                            <Td>
                                <Button
                                    colorScheme="green"
                                    onClick={() =>
                                        handleImportCompetition(competition.id)
                                    }
                                >
                                    Import
                                </Button>
                            </Td>
                        </Tr>
                    ))}
                </Tbody>
            </Table>
        </TableContainer>
    );
};

export default CompetitionsList;
