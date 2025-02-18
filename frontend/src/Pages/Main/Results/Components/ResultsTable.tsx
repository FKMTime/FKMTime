import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { Result } from "@/lib/interfaces";
import { isOrganizerOrDelegate } from "@/lib/permissions";

import ResultRow from "./ResultRow";

interface ResultsTableProps {
    results: Result[];
    maxAttempts: number;
    fetchData: (roundId: string, searchParam?: string) => void;
}

const ResultsTable = ({
    results,
    maxAttempts,
    fetchData,
}: ResultsTableProps) => {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Name (ID)</TableHead>
                    {Array.from({ length: maxAttempts }, (_, i) => (
                        <TableHead className="w-2 hidden md:table-cell" key={i}>
                            {i + 1}
                        </TableHead>
                    ))}
                    <TableHead className="hidden md:table-cell">
                        Average
                    </TableHead>
                    <TableHead className="hidden md:table-cell">Best</TableHead>
                    {isOrganizerOrDelegate() && <TableHead>Actions</TableHead>}
                </TableRow>
            </TableHeader>
            <TableBody>
                {results.map((result: Result) => (
                    <ResultRow
                        key={result.id}
                        result={result}
                        maxAttempts={maxAttempts}
                        fetchData={fetchData}
                    />
                ))}
            </TableBody>
        </Table>
    );
};

export default ResultsTable;
