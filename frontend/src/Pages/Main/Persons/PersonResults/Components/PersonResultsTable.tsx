import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { isAdmin } from "@/lib/auth";
import { Result } from "@/lib/interfaces";

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
                    {isAdmin() && <TableHead>Actions</TableHead>}
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
