import { Eraser, List, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import {
    AdvancingBadge,
    LiveSyncBadge,
} from "@/Components/IntegratedLive/LiveResultBadges";
import RowActions, { RowAction } from "@/Components/shared/RowActions";
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
import {
    IntegratedLiveOnlyInWca,
    IntegratedLiveResultView,
    Result,
} from "@/lib/interfaces";
import { RankedResult } from "@/lib/ranking";
import {
    attemptWithPenaltyToString,
    resultToString,
} from "@/lib/resultFormatters";
import { deleteResultById } from "@/lib/results";

/** WCA Integrated Live Results next to the table (SPEC-006 section 5) */
export interface ResultsTableLive {
    byResultId: Map<string, IntegratedLiveResultView>;
    /** Results the WCA has that FKMTime doesn't, shown greyed at the end */
    onlyInWca: IntegratedLiveOnlyInWca[];
    /** Extra row menu items, e.g. Clear and Remove from round */
    itemsFor: (result: Result, view?: IntegratedLiveResultView) => RowAction[];
    onClearOnlyInWca: (row: IntegratedLiveOnlyInWca) => void;
}

interface ResultsTableProps {
    rows: RankedResult[];
    maxAttempts: number;
    onDeleted: () => void;
    live?: ResultsTableLive;
}

const averageText = (row: RankedResult) =>
    row.average === null ? "" : resultToString(row.average);

const ResultsTable = ({
    rows,
    maxAttempts,
    onDeleted,
    live,
}: ResultsTableProps) => {
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
                ...(live?.itemsFor(result, live.byResultId.get(result.id)) ??
                    []),
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

    const badges = (result: Result) => {
        const view = live?.byResultId.get(result.id);
        if (!view) return null;
        return (
            <span className="ml-2 inline-flex gap-1 align-middle">
                <AdvancingBadge view={view} />
                <LiveSyncBadge view={view} />
            </span>
        );
    };

    const onlyInWca = live?.onlyInWca ?? [];
    const onlyInWcaName = (row: IntegratedLiveOnlyInWca) =>
        row.name ?? `Registration ${row.registrationId}`;
    const onlyInWcaActions = (row: IntegratedLiveOnlyInWca) => (
        <RowActions
            subject={onlyInWcaName(row)}
            items={[
                {
                    label: "Clear in WCA live results",
                    icon: Eraser,
                    destructive: true,
                    onSelect: () => live?.onClearOnlyInWca(row),
                },
            ]}
        />
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
                                    {badges(row.result)}
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
                        {onlyInWca.map((row) => (
                            <TableRow
                                key={`wca-${row.registrationId}`}
                                className="text-muted-foreground"
                            >
                                <TableCell className="pl-5">—</TableCell>
                                <TableCell>
                                    <span className="font-semibold">
                                        {onlyInWcaName(row)}
                                    </span>
                                    <span className="ml-2 text-xs">
                                        Only in WCA live results
                                    </span>
                                </TableCell>
                                {Array.from({ length: maxAttempts }, (_, i) => (
                                    <TableCell
                                        key={i}
                                        className="whitespace-nowrap text-right"
                                    >
                                        {row.attempts[i] !== undefined
                                            ? resultToString(row.attempts[i])
                                            : ""}
                                    </TableCell>
                                ))}
                                <TableCell />
                                <TableCell />
                                <TableCell className="pr-3">
                                    {onlyInWcaActions(row)}
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
                                {badges(row.result)}
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
                {onlyInWca.map((row) => (
                    <li
                        key={`wca-${row.registrationId}`}
                        className="flex items-center gap-3 py-2.5 pl-4 pr-1.5 text-muted-foreground"
                    >
                        <span className="w-6 text-sm text-faint">—</span>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">
                                {onlyInWcaName(row)}
                            </p>
                            <p className="truncate text-xs">
                                Only in WCA live results:{" "}
                                {row.attempts.map(resultToString).join("  ")}
                            </p>
                        </div>
                        {onlyInWcaActions(row)}
                    </li>
                ))}
            </ul>
        </>
    );
};

export default ResultsTable;
