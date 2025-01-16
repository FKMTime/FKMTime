import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { Incident } from "@/lib/interfaces";

import ResultsCheckRow from "./ResultsCheckRow";

interface ResultsChecksTableProps {
    checks: Incident[];
}

const ResultsChecksTable = ({ checks }: ResultsChecksTableProps) => {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Person</TableHead>
                    <TableHead>Round</TableHead>
                    <TableHead>Attempt</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Comment</TableHead>
                    <TableHead>Judge</TableHead>
                    <TableHead>Warnings</TableHead>
                    <TableHead>Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {checks.map((item) => (
                    <ResultsCheckRow key={item.id} check={item} />
                ))}
            </TableBody>
        </Table>
    );
};

export default ResultsChecksTable;
