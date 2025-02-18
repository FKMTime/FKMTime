import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { Result } from "@/lib/interfaces";
import { isOrganizerOrDelegate } from "@/lib/permissions";

import PersonResultRow from "./PersonResultRow";

interface PersonResultsTableProps {
    results: Result[];
}

const PersonResultsTable = ({ results }: PersonResultsTableProps) => {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Round</TableHead>
                    <TableHead>Average</TableHead>
                    <TableHead>Best</TableHead>
                    {isOrganizerOrDelegate() && <TableHead>Actions</TableHead>}
                </TableRow>
            </TableHeader>
            <TableBody>
                {results.map((result: Result) => (
                    <PersonResultRow key={result.id} result={result} />
                ))}
            </TableBody>
        </Table>
    );
};

export default PersonResultsTable;
