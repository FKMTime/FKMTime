import { useAtomValue } from "jotai";
import { List } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import AttemptWarnings from "@/Components/AttemptWarnings";
import LoadingPage from "@/Components/LoadingPage";
import EmptyState from "@/Components/shared/EmptyState";
import RoundStrip from "@/Components/shared/RoundStrip";
import RowActions from "@/Components/shared/RowActions";
import SegmentedControl from "@/Components/shared/SegmentedControl";
import { Button } from "@/Components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { usePageHeader } from "@/hooks/usePageHeader";
import { competitionAtom } from "@/lib/atoms";
import { getEventIconClass } from "@/lib/events";
import { AttemptType, Incident, Room } from "@/lib/interfaces";
import {
    CHECK_TYPE_LABELS,
    CheckType,
    getCheckTypes,
} from "@/lib/resultChecks";
import { attemptWithPenaltyToString } from "@/lib/resultFormatters";
import { getResultsChecks } from "@/lib/results";
import { getAllRooms } from "@/lib/rooms";
import { getRoundOptions, getStripRounds } from "@/lib/roundOptions";
import { cn, shortRoundName } from "@/lib/utils";

import ResultsTabs from "../Components/ResultsTabs";

type Filter = "all" | CheckType;

const attemptLabel = (check: Incident) =>
    check.type === AttemptType.EXTRA_ATTEMPT
        ? `E${check.attemptNumber}`
        : `${check.attemptNumber}`;

/** Suspicious times, penalties and staffing, for one round or all of them */
const ResultsChecks = () => {
    const { id: roundId = "" } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const competition = useAtomValue(competitionAtom);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [checks, setChecks] = useState<Incident[] | null>(null);
    const [filter, setFilter] = useState<Filter>("all");

    usePageHeader({
        crumbs: [{ label: "Results", to: "/results" }, { label: "Checks" }],
    });

    useEffect(() => {
        getAllRooms().then(setRooms);
    }, []);

    useEffect(() => {
        setChecks(null);
        getResultsChecks(roundId || undefined).then(setChecks);
    }, [roundId]);

    const rounds = useMemo(
        () => (competition ? getRoundOptions(competition.wcif, rooms) : []),
        [competition, rooms]
    );

    if (!competition || !checks) return <LoadingPage />;

    const typesPresent = (Object.keys(CHECK_TYPE_LABELS) as CheckType[]).filter(
        (type) => checks.some((check) => getCheckTypes(check).includes(type))
    );
    const visible =
        filter === "all"
            ? checks
            : checks.filter((check) => getCheckTypes(check).includes(filter));

    const actions = (check: Incident) => (
        <RowActions
            subject={check.result.person.name}
            primary={{
                label: "View attempts",
                icon: List,
                onSelect: () => navigate(`/results/${check.result.id}`),
            }}
        />
    );

    const roundLink = (check: Incident) => (
        <Link
            to={`/results/round/${check.result.roundId}`}
            className="inline-flex items-center gap-1.5 whitespace-nowrap text-primary hover:underline"
        >
            <span
                aria-hidden
                className={cn(
                    "cubing-icon",
                    getEventIconClass(check.result.roundId.split("-")[0])
                )}
            />
            {shortRoundName(check.result.roundId)}
        </Link>
    );

    return (
        <div className="flex flex-col gap-4">
            <ResultsTabs value="checks" roundId={roundId} />
            <RoundStrip
                rounds={getStripRounds(rounds, roundId)}
                allRounds={rounds}
                value={roundId}
                onValueChange={(id) => navigate(`/results/checks/${id}`)}
            />
            <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-muted-foreground">
                    {roundId
                        ? `Checks for ${shortRoundName(roundId)}`
                        : "Checks across every round"}
                </p>
                {roundId && (
                    <Button
                        variant="link"
                        className="h-auto px-0"
                        onClick={() => navigate("/results/checks")}
                    >
                        Show every round
                    </Button>
                )}
            </div>
            {typesPresent.length > 1 && (
                <SegmentedControl
                    label="Check type"
                    value={filter}
                    onValueChange={setFilter}
                    options={[
                        {
                            value: "all",
                            label: (
                                <>
                                    All
                                    <span className="text-xs text-faint">
                                        {checks.length}
                                    </span>
                                </>
                            ),
                        },
                        ...typesPresent.map((type) => ({
                            value: type,
                            label: (
                                <>
                                    {CHECK_TYPE_LABELS[type]}
                                    <span className="text-xs text-faint">
                                        {
                                            checks.filter((check) =>
                                                getCheckTypes(check).includes(
                                                    type
                                                )
                                            ).length
                                        }
                                    </span>
                                </>
                            ),
                        })),
                    ]}
                />
            )}

            {visible.length === 0 ? (
                <EmptyState>No suspicious results found.</EmptyState>
            ) : (
                <>
                    <div className="hidden overflow-x-auto rounded-2xl border bg-card md:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-5">
                                        Competitor
                                    </TableHead>
                                    <TableHead>Round</TableHead>
                                    <TableHead>Attempt</TableHead>
                                    <TableHead>Time</TableHead>
                                    <TableHead>Comment</TableHead>
                                    <TableHead>Judge</TableHead>
                                    <TableHead>Warnings</TableHead>
                                    <TableHead>
                                        <span className="sr-only">Actions</span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {visible.map((check) => (
                                    <TableRow key={check.id}>
                                        <TableCell className="pl-5 font-semibold">
                                            {check.result.person.name}
                                        </TableCell>
                                        <TableCell>
                                            {roundLink(check)}
                                        </TableCell>
                                        <TableCell>
                                            {attemptLabel(check)}
                                        </TableCell>
                                        <TableCell className="font-semibold">
                                            {attemptWithPenaltyToString(check)}
                                        </TableCell>
                                        <TableCell className="max-w-48 truncate text-muted-foreground">
                                            {check.comment || "—"}
                                        </TableCell>
                                        <TableCell>
                                            {check.judge?.name}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1.5">
                                                <AttemptWarnings
                                                    attempt={check}
                                                />
                                            </div>
                                        </TableCell>
                                        <TableCell className="pr-3">
                                            {actions(check)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <ul className="flex flex-col divide-y overflow-hidden rounded-mobile-card border bg-card md:hidden">
                        {visible.map((check) => (
                            <li
                                key={check.id}
                                className="flex items-start gap-2 py-3 pl-4 pr-1.5"
                            >
                                <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                                    <p className="flex flex-wrap items-baseline gap-x-2">
                                        <span className="font-semibold">
                                            {check.result.person.name}
                                        </span>
                                        {roundLink(check)}
                                        <span>· A{attemptLabel(check)}</span>
                                        <b className="ml-auto">
                                            {attemptWithPenaltyToString(check)}
                                        </b>
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        <AttemptWarnings attempt={check} />
                                    </div>
                                </div>
                                {actions(check)}
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
};

export default ResultsChecks;
