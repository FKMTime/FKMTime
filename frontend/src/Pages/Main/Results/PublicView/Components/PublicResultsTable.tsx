import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { ResultWithAverage } from "@/lib/interfaces";

import PublicResultRow from "./PublicResultRow";

interface PublicResultsTableProps {
    results: ResultWithAverage[];
    maxAttempts: number;
}

const PublicResultsTable = ({
    results,
    maxAttempts,
}: PublicResultsTableProps) => {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Pos</TableHead>
                    <TableHead>Name</TableHead>

                    {Array.from({ length: maxAttempts }, (_, i) => (
                        <TableHead key={i} className="w-2 hidden md:table-cell">
                            {i + 1}
                        </TableHead>
                    ))}
                    <TableHead>Average</TableHead>
                    <TableHead>Best</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {results.map((result: ResultWithAverage, i: number) => (
                    <PublicResultRow
                        key={result.id}
                        result={result}
                        maxAttempts={maxAttempts}
                        pos={i + 1}
                    />
                ))}
            </TableBody>
        </Table>
    );
};

export default PublicResultsTable;
