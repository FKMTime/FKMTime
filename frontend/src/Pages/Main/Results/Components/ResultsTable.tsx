import { List, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import RowActions from "@/Components/shared/RowActions";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import { formattedBest } from "@/lib/average";
import { Result } from "@/lib/interfaces";
import { RankedResult } from "@/lib/ranking";
import {
    attemptWithPenaltyToString,
    resultToString,
} from "@/lib/resultFormatters";
import { deleteResultById } from "@/lib/results";

interface ResultsTableProps {
    rows: RankedResult[];
    maxAttempts: number;
    onDeleted: () => void;
}

const averageText = (row: RankedResult) =>
    row.average === null ? "" : resultToString(row.average);

const ResultsTable = ({ rows, maxAttempts, onDeleted }: ResultsTableProps) => {
    const navigate = useNavigate();
    const confirm = useConfirm();
    const { toast } = useToast();

    const handleDelete = (result: Result) => {
        confirm({
            title: `Delete the result of ${result.person.name}?`,
            description: "This action cannot be undone.",
            confirmLabel: "Delete result",
            onConfirm: async () => {
                const status = await deleteResultById(result.id);
                if (status === 204) {
                    onDeleted();
                } else {
                    toast({
                        title: "Error",
                        description: "Something went wrong",
                        variant: "destructive",
                    });
                }
            },
        }).catch(() => undefined);
    };

    const actions = (result: Result) => (
        <RowActions
            subject={result.person.name}
            primary={{
                label: "View attempts",
                icon: List,
                onSelect: () => navigate(`/results/${result.id}`),
            }}
            items={[
                {
                    label: "Delete result",
                    icon: Trash2,
                    destructive: true,
                    onSelect: () => handleDelete(result),
                },
            ]}
        />
    );

    const name = (result: Result) => (
        <>
            <span className="font-semibold">{result.person.name}</span>
            {result.person.registrantId && (
                <span className="text-faint">
                    {" "}
                    ({result.person.registrantId})
                </span>
            )}
        </>
    );

    return (
        <>
            <div className="hidden overflow-x-auto md:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12 pl-5">#</TableHead>
                            <TableHead>Competitor</TableHead>
                            {Array.from({ length: maxAttempts }, (_, i) => (
                                <TableHead key={i} className="text-right">
                                    {i + 1}
                                </TableHead>
                            ))}
                            <TableHead className="text-right">
                                Average
                            </TableHead>
                            <TableHead className="text-right">Best</TableHead>
                            <TableHead>
                                <span className="sr-only">Actions</span>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((row) => (
                            <TableRow key={row.result.id}>
                                <TableCell className="pl-5 text-muted-foreground">
                                    {row.position}
                                </TableCell>
                                <TableCell>
                                    <Link
                                        to={`/results/${row.result.id}`}
                                        className="hover:underline"
                                    >
                                        {name(row.result)}
                                    </Link>
                                </TableCell>
                                {Array.from({ length: maxAttempts }, (_, i) => (
                                    <TableCell
                                        key={i}
                                        className="whitespace-nowrap text-right"
                                    >
                                        {row.submitted[i]
                                            ? attemptWithPenaltyToString(
                                                  row.submitted[i]
                                              )
                                            : ""}
                                    </TableCell>
                                ))}
                                <TableCell className="text-right font-bold">
                                    {averageText(row)}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                    {formattedBest(row.submitted)}
                                </TableCell>
                                <TableCell className="pr-3">
                                    {actions(row.result)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <ul className="flex flex-col divide-y md:hidden">
                {rows.map((row) => (
                    <li
                        key={row.result.id}
                        className="flex items-center gap-3 py-2.5 pl-4 pr-1.5"
                    >
                        <span className="w-6 text-sm text-faint">
                            {row.position}
                        </span>
                        <Link
                            to={`/results/${row.result.id}`}
                            className="min-w-0 flex-1"
                        >
                            <p className="truncate text-sm">
                                {name(row.result)}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                                {row.submitted
                                    .map(attemptWithPenaltyToString)
                                    .join("  ")}
                            </p>
                        </Link>
                        <div className="text-right text-sm">
                            <p className="font-bold">{averageText(row)}</p>
                            <p className="text-xs text-muted-foreground">
                                {formattedBest(row.submitted)}
                            </p>
                        </div>
                        {actions(row.result)}
                    </li>
                ))}
            </ul>
        </>
    );
};

export default ResultsTable;
