import { Button } from "@/Components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
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
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {competitions.map((competition) => (
                    <TableRow>
                        <TableCell>{competition.name}</TableCell>
                        <TableCell>
                            <Button
                                variant="success"
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
    );
};

export default CompetitionsList;
