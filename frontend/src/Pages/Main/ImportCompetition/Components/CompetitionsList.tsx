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
            <Table >
                <TableHead>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Actions</TableHead>
                    </TableRow>
                </TableHead>
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
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default CompetitionsList;
