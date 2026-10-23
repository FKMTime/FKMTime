import { useAtomValue } from "jotai";
import { List } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getPersonFromWcif } from "wcif-helpers";

import Avatar from "@/Components/Avatar/Avatar";
import LoadingPage from "@/Components/LoadingPage";
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
import { usePageHeader } from "@/hooks/usePageHeader";
import { activityCodeToName } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";
import { average, best } from "@/lib/average";
import { getEventIconClass } from "@/lib/events";
import { Person, Result } from "@/lib/interfaces";
import { isOrganizerOrDelegate } from "@/lib/permissions";
import { getPersonById } from "@/lib/persons";
import {
    attemptWithPenaltyToString,
    resultToString,
} from "@/lib/resultFormatters";
import { getAllResultsByPersonId } from "@/lib/results";
import {
    cn,
    getSubmittedAttempts,
    regionNameByIso2,
    shortRoundName,
} from "@/lib/utils";

const PersonResults = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const competition = useAtomValue(competitionAtom);
    const [results, setResults] = useState<Result[] | null>(null);
    const [person, setPerson] = useState<Person | null>(null);

    useEffect(() => {
        if (!id) return;
        getAllResultsByPersonId(id).then(setResults);
        getPersonById(id).then(setPerson);
    }, [id]);

    usePageHeader({
        crumbs: [
            { label: "Persons", to: "/persons" },
            { label: person?.name ?? "Results" },
        ],
        title: person?.name ?? "Results",
        subtitle: "Results",
        backTo: "/persons",
    });

    if (!results || !person) return <LoadingPage />;

    const wcifPerson =
        person.registrantId && competition
            ? getPersonFromWcif(person.registrantId, competition.wcif)
            : undefined;
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

    return (
        <div className="flex flex-col gap-5">
            <header className="flex items-center gap-4">
                <Avatar
                    username={person.name}
                    avatarUrl={wcifPerson?.avatar?.thumbUrl}
                    fullAvatarUrl={wcifPerson?.avatar?.url}
                    className="size-14"
                />
                <div className="min-w-0">
                    <h2 className="truncate text-xl font-bold">
                        {person.name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {[
                            person.registrantId && `ID ${person.registrantId}`,
                            person.wcaId ?? "Newcomer",
                            person.countryIso2 &&
                                regionNameByIso2(person.countryIso2),
                        ]
                            .filter(Boolean)
                            .join(" · ")}
                    </p>
                </div>
            </header>

            {rows.length === 0 ? (
                <EmptyState>No results yet.</EmptyState>
            ) : (
                <>
                    <div className="hidden overflow-x-auto rounded-2xl border bg-card md:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-5">
                                        Round
                                    </TableHead>
                                    <TableHead>Group</TableHead>
                                    <TableHead className="text-right">
                                        Average
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Best
                                    </TableHead>
                                    <TableHead>Attempts</TableHead>
                                    {canViewAttempts && (
                                        <TableHead>
                                            <span className="sr-only">
                                                Actions
                                            </span>
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
                                        <TableCell>
                                            {row.group ?? "—"}
                                        </TableCell>
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
                                        {row.attempts.join("  ")} · best{" "}
                                        {row.best}
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
                                        <div className="px-4 py-3">
                                            {content}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
        </div>
    );
};

export default PersonResults;
