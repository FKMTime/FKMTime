import { useAtomValue } from "jotai";
import { Ban, List } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getRoundInfoFromWcif } from "wcif-helpers";

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
import { useToast } from "@/hooks/useToast";
import { activityCodeToName } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";
import { average, best } from "@/lib/average";
import { getEventIconClass, getEventName } from "@/lib/events";
import { AttemptStatus, Result } from "@/lib/interfaces";
import { isDelegate, isOrganizerOrDelegate } from "@/lib/permissions";
import {
    attemptWithPenaltyToString,
    resultToString,
} from "@/lib/resultFormatters";
import {
    cn,
    getAttemptsToDnf,
    getSubmittedAttempts,
    shortRoundName,
} from "@/lib/utils";
import DnfAttemptsModal from "@/Pages/Main/Results/SingleResult/Components/DnfAttemptsModal";

interface PersonResultsProps {
    results: Result[];
    onChange: () => void;
}

const roundNumber = (roundId: string) => +roundId.split("-r")[1];

const PersonResults = ({ results, onChange }: PersonResultsProps) => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const competition = useAtomValue(competitionAtom);
    const canViewAttempts = isOrganizerOrDelegate();
    const canDnf = isDelegate();
    const [dnfEventId, setDnfEventId] = useState<string | null>(null);

    /** Every round of the event this competitor has a result in, in order */
    const eventResults = (eventId: string) =>
        results
            .filter(
                (result) =>
                    result.eventId === eventId &&
                    !!competition &&
                    getRoundInfoFromWcif(result.roundId, competition.wcif)
                        ?.format !== "h"
            )
            .sort((a, b) => roundNumber(a.roundId) - roundNumber(b.roundId));

    const dnfAction = (eventId: string) => ({
        label: `DNF all attempts in ${getEventName(eventId) || eventId}`,
        icon: Ban,
        hidden:
            !canDnf ||
            !eventResults(eventId).some(
                (result) => getAttemptsToDnf(result.attempts).length > 0
            ),
        onSelect: () => {
            const hasOpenIncident = eventResults(eventId).some((result) =>
                result.attempts.some(
                    (attempt) => attempt.status === AttemptStatus.UNRESOLVED
                )
            );
            if (hasOpenIncident) {
                toast({
                    title: "Resolve the open incidents first",
                    variant: "destructive",
                });
            } else {
                setDnfEventId(eventId);
            }
        },
    });

    const closeDnfModal = () => {
        setDnfEventId(null);
        onChange();
    };

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
                                            items={[
                                                dnfAction(row.result.eventId),
                                            ]}
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
                        <li
                            key={row.result.id}
                            className="flex items-center gap-1 pr-2"
                        >
                            {canViewAttempts ? (
                                <Link
                                    to={`/results/${row.result.id}`}
                                    className="block min-w-0 flex-1 px-4 py-3 active:bg-accent"
                                >
                                    {content}
                                </Link>
                            ) : (
                                <div className="min-w-0 flex-1 px-4 py-3">
                                    {content}
                                </div>
                            )}
                            {canDnf && (
                                <RowActions
                                    subject={activityCodeToName(
                                        row.result.roundId
                                    )}
                                    items={[dnfAction(row.result.eventId)]}
                                />
                            )}
                        </li>
                    );
                })}
            </ul>

            {dnfEventId && (
                <DnfAttemptsModal
                    isOpen
                    onClose={closeDnfModal}
                    onDone={closeDnfModal}
                    personName={results[0].person.name}
                    results={eventResults(dnfEventId)}
                />
            )}
        </>
    );
};

export default PersonResults;
