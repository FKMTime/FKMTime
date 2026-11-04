import { List } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import EmptyState from "@/Components/shared/EmptyState";
import RowActions from "@/Components/shared/RowActions";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { activityCodeToName } from "@/lib/activities";
import { average, best } from "@/lib/average";
import { getEventIconClass } from "@/lib/events";
import { Result } from "@/lib/interfaces";
import { isOrganizerOrDelegate } from "@/lib/permissions";
import {
    attemptWithPenaltyToString,
    resultToString,
} from "@/lib/resultFormatters";
import { cn, getSubmittedAttempts, shortRoundName } from "@/lib/utils";

interface PersonResultsProps {
    results: Result[];
}

const PersonResults = ({ results }: PersonResultsProps) => {
    const navigate = useNavigate();
    const canViewAttempts = isOrganizerOrDelegate();

    const rows = results.map((result) => {
        const submitted = getSubmittedAttempts(result.attempts);
        const resultAverage = average(submitted);
        return {
            result,
            group: result.groupId?.split("-g")[1],
            average: resultAverage ? resultToString(resultAverage) : "—",
            best: submitted.length ? resultToString(best(submitted)) : "—",
            attempts: submitted.map(attemptWithPenaltyToString),
        };
    });

    if (rows.length === 0) return <EmptyState>No results yet.</EmptyState>;

    return (
        <>
            <div className="hidden overflow-x-auto rounded-2xl border bg-card md:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="pl-5">Round</TableHead>
                            <TableHead>Group</TableHead>
                            <TableHead className="text-right">
                                Average
                            </TableHead>
                            <TableHead className="text-right">Best</TableHead>
                            <TableHead>Attempts</TableHead>
                            {canViewAttempts && (
                                <TableHead>
                                    <span className="sr-only">Actions</span>
                                </TableHead>
                            )}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((row) => (
                            <TableRow key={row.result.id}>
                                <TableCell className="pl-5">
                                    <Link
                                        to={`/results/round/${row.result.roundId}`}
                                        className="inline-flex items-center gap-2 font-semibold hover:underline"
                                    >
                                        <span
                                            aria-hidden
                                            className={cn(
                                                "cubing-icon",
                                                getEventIconClass(
                                                    row.result.eventId
                                                )
                                            )}
                                        />
                                        {activityCodeToName(
                                            row.result.roundId
                                        ).replace(", ", " · ")}
                                    </Link>
                                </TableCell>
                                <TableCell>{row.group ?? "—"}</TableCell>
                                <TableCell className="text-right font-bold">
                                    {row.average}
                                </TableCell>
                                <TableCell className="text-right">
                                    {row.best}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                    {row.attempts.join("  ")}
                                </TableCell>
                                {canViewAttempts && (
                                    <TableCell className="pr-3">
                                        <RowActions
                                            subject={activityCodeToName(
                                                row.result.roundId
                                            )}
                                            primary={{
                                                label: "View attempts",
                                                icon: List,
                                                onSelect: () =>
                                                    navigate(
                                                        `/results/${row.result.id}`
                                                    ),
                                            }}
                                        />
                                    </TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <ul className="flex flex-col divide-y overflow-hidden rounded-mobile-card border bg-card md:hidden">
                {rows.map((row) => {
                    const content = (
                        <>
                            <div className="flex items-baseline gap-2">
                                <span className="min-w-0 flex-1 truncate font-semibold">
                                    {shortRoundName(row.result.roundId)}
                                    {row.group && (
                                        <span className="font-normal text-muted-foreground">
                                            {" "}
                                            · Group {row.group}
                                        </span>
                                    )}
                                </span>
                                <b>{row.average}</b>
                            </div>
                            <p className="text-[13px] text-muted-foreground">
                                {row.attempts.join("  ")} · best {row.best}
                            </p>
                        </>
                    );
                    return (
                        <li key={row.result.id}>
                            {canViewAttempts ? (
                                <Link
                                    to={`/results/${row.result.id}`}
                                    className="block px-4 py-3 active:bg-accent"
                                >
                                    {content}
                                </Link>
                            ) : (
                                <div className="px-4 py-3">{content}</div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </>
    );
};

export default PersonResults;
