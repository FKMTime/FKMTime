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

import { WCACompetition } from "@/lib/interfaces";

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
                    <TableRow bg="gray.400">
                        <TableHead>Name</TableHead>
                        <TableHead>Actions</TableHead>
                    </TableRow>
                </Thead>
                <TableBody>
                    {competitions.map((competition) => (
                        <TableRow>
                            <TableCell>{competition.name}</TableCell>
                            <TableCell>
                                <Button
                                    colorScheme="green"
                                    onClick={() =>
                                        handleImportCompetition(competition.id)
                                    }
                                >
                                    Import
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </Tbody>
            </Table>
        </TableContainer>
    );
};

export default CompetitionsList;
