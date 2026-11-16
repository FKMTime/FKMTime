import { ArrowDown, ArrowUp } from "lucide-react";
import { ReactNode, useMemo, useState } from "react";

import EmptyState from "@/Components/shared/EmptyState";
import SearchInput from "@/Components/shared/SearchInput";
import SectionLoading from "@/Components/shared/SectionLoading";
import SegmentedControl from "@/Components/shared/SegmentedControl";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { attendanceStatisticsQuery } from "@/lib/attendance";
import {
    AttendanceSummary,
    PersonAttendance,
    RoundAttendance,
    StaffingRole,
} from "@/lib/interfaces";
import { LIVE_MAX_AGE } from "@/lib/queryCache";
import { cn } from "@/lib/utils";

import AttendanceTabs from "../Components/AttendanceTabs";

const ROLE_LABELS: Record<StaffingRole, string> = {
    JUDGE: "Judge",
    SCRAMBLER: "Scrambler",
    RUNNER: "Runner",
    DELEGATE: "Delegate",
    STAFF_OTHER: "Other staff",
};

type RoleFilter = "all" | StaffingRole;

type SortKey = Exclude<keyof PersonAttendance, "personId" | "roles">;

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
    { key: "personName", label: "Name" },
    { key: "attendancePct", label: "Attendance", numeric: true },
    { key: "assigned", label: "Assigned", numeric: true },
    { key: "present", label: "Present", numeric: true },
    { key: "late", label: "Late", numeric: true },
    { key: "absent", label: "Absent", numeric: true },
    { key: "replaced", label: "Replaced", numeric: true },
    { key: "leftEarly", label: "Left early", numeric: true },
    { key: "noShow", label: "No-show", numeric: true },
    { key: "extraHelp", label: "Extra help", numeric: true },
];

/** success from 90%, warning from 70%, below that destructive */
const attendanceTone = (percentage: number) =>
    percentage >= 90
        ? "bg-success"
        : percentage >= 70
          ? "bg-warning"
          : "bg-destructive";

const formatPct = (percentage: number | null) =>
    percentage === null ? "—" : `${Math.round(percentage)}%`;

/** Thin bar against a same-track background; the figure beside it carries the value */
const Meter = ({
    percentage,
    className,
}: {
    percentage: number | null;
    className?: string;
}) => (
    <span
        aria-hidden
        className={cn(
            "block h-1.5 overflow-hidden rounded-full bg-track",
            className
        )}
    >
        {percentage !== null && (
            <span
                className={cn(
                    "block h-full rounded-full",
                    attendanceTone(percentage)
                )}
                style={{ width: `${Math.min(100, percentage)}%` }}
            />
        )}
    </span>
);

const StatTile = ({
    label,
    value,
    detail,
    children,
}: {
    label: string;
    value: ReactNode;
    detail?: ReactNode;
    children?: ReactNode;
}) => (
    <div className="flex flex-col gap-1 rounded-mobile-card border bg-card p-3.5 md:rounded-2xl md:p-4">
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
        {detail && <dd className="text-xs text-muted-foreground">{detail}</dd>}
        {children}
    </div>
);

const SummaryTiles = ({ summary }: { summary: AttendanceSummary }) => (
    <dl
        aria-label="Summary"
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6"
    >
        <StatTile
            label="Attendance"
            value={formatPct(summary.attendancePct)}
            detail={`${summary.covered} of ${summary.expected} assignments covered`}
        >
            <Meter percentage={summary.attendancePct} className="mt-1" />
        </StatTile>
        <StatTile
            label="Late"
            value={summary.late}
            detail="Counted as attended"
        />
        <StatTile
            label="Absent"
            value={summary.absent}
            detail={`${summary.noShows} not coming for the day`}
        />
        <StatTile
            label="Replaced"
            value={summary.replaced}
            detail="Came, someone else did it"
        />
        <StatTile
            label="Left early"
            value={summary.leftEarly}
            detail="Before the group ended"
        />
        <StatTile
            label="Extra help"
            value={summary.extraHelp}
            detail="Helped without an assignment"
        />
    </dl>
);

const RoundBreakdown = ({ rounds }: { rounds: RoundAttendance[] }) => (
    <section
        aria-labelledby="attendance-by-round"
        className="flex flex-col gap-3 rounded-mobile-card border bg-card p-4 md:rounded-2xl md:p-5"
    >
        <h2 id="attendance-by-round" className="text-sm font-semibold">
            By round
        </h2>
        <ol className="flex flex-col gap-3 sm:gap-2">
            {rounds.map((round) => (
                <li
                    key={round.roundId}
                    aria-label={`${round.roundName}: ${formatPct(round.attendancePct)}, ${round.covered} of ${round.expected} covered`}
                    className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 text-sm sm:grid-cols-[10rem_1fr_7rem]"
                >
                    <span className="truncate font-medium">
                        {round.roundName}
                    </span>
                    <Meter
                        percentage={round.attendancePct}
                        className="col-span-2 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1"
                    />
                    <span className="text-right tabular-nums text-muted-foreground">
                        <b className="font-semibold text-foreground">
                            {formatPct(round.attendancePct)}
                        </b>{" "}
                        {round.covered}/{round.expected}
                    </span>
                </li>
            ))}
        </ol>
    </section>
);

const comparePersons = (
    a: PersonAttendance,
    b: PersonAttendance,
    key: SortKey
) =>
    key === "personName"
        ? a.personName.localeCompare(b.personName)
        : (a[key] ?? 0) - (b[key] ?? 0);

const AttendanceStatistics = () => {
    const { data: statistics } = useLiveQuery(attendanceStatisticsQuery, {
        maxAge: LIVE_MAX_AGE,
    });
    const [search, setSearch] = useState("");
    const [role, setRole] = useState<RoleFilter>("all");
    const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({
        key: "attendancePct",
        descending: false,
    });

    const roles = (Object.keys(ROLE_LABELS) as StaffingRole[]).filter(
        (key) => statistics?.byRole[key]
    );
    // A role that no longer has anyone falls back to everyone
    const view =
        role !== "all" && statistics?.byRole[role]
            ? statistics.byRole[role]
            : statistics;

    const rows = useMemo(() => {
        const query = search.trim().toLowerCase();
        const filtered = (view?.persons ?? []).filter((row) =>
            row.personName.toLowerCase().includes(query)
        );
        const sorted = [...filtered].sort((a, b) =>
            comparePersons(a, b, sort.key)
        );
        if (sort.descending) sorted.reverse();
        // No percentage (extra help only) is no rank: last either way
        return sort.key === "attendancePct"
            ? [
                  ...sorted.filter((row) => row.attendancePct !== null),
                  ...sorted.filter((row) => row.attendancePct === null),
              ]
            : sorted;
    }, [view, search, sort]);

    // The tabs stay put while the statistics load
    if (!statistics || !view)
        return (
            <div className="flex flex-col gap-4">
                <AttendanceTabs value="statistics" />
                <SectionLoading label="Loading attendance statistics" />
            </div>
        );

    const toggleSort = (key: SortKey) =>
        setSort((current) => ({
            key,
            descending: current.key === key ? !current.descending : false,
        }));

    if (statistics.persons.length === 0)
        return (
            <div className="flex flex-col gap-4">
                <AttendanceTabs value="statistics" />
                <EmptyState>
                    No staffing in groups that have started yet.
                </EmptyState>
            </div>
        );

    return (
        <div className="flex flex-col gap-4">
            <AttendanceTabs value="statistics" />
            {roles.length > 1 && (
                <SegmentedControl
                    label="Role"
                    value={role}
                    onValueChange={setRole}
                    options={[
                        { value: "all" as RoleFilter, label: "All roles" },
                        ...roles.map((key) => ({
                            value: key as RoleFilter,
                            label: ROLE_LABELS[key],
                        })),
                    ]}
                />
            )}
            <SummaryTiles summary={view.summary} />
            {view.rounds.length > 0 && <RoundBreakdown rounds={view.rounds} />}

            <SearchInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                label="Search staff"
            />
            {rows.length === 0 ? (
                <EmptyState>Nobody matches this search.</EmptyState>
            ) : (
                <div className="overflow-x-auto rounded-mobile-card border bg-card md:rounded-2xl">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {COLUMNS.map((column) => (
                                    <TableHead
                                        key={column.key}
                                        aria-sort={
                                            sort.key === column.key
                                                ? sort.descending
                                                    ? "descending"
                                                    : "ascending"
                                                : undefined
                                        }
                                        className={cn(
                                            "whitespace-nowrap",
                                            column.key === "personName" &&
                                                "pl-4 md:pl-5",
                                            column.numeric && "text-right",
                                            column.key === "extraHelp" && "pr-4"
                                        )}
                                    >
                                        <button
                                            type="button"
                                            onClick={() =>
                                                toggleSort(column.key)
                                            }
                                            className="inline-flex min-h-11 items-center gap-1 hover:text-foreground md:min-h-0"
                                        >
                                            {column.label}
                                            {sort.key === column.key &&
                                                (sort.descending ? (
                                                    <ArrowDown className="size-3.5" />
                                                ) : (
                                                    <ArrowUp className="size-3.5" />
                                                ))}
                                        </button>
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((row) => (
                                <TableRow key={row.personId}>
                                    <TableCell className="pl-4 md:pl-5">
                                        <span className="block font-medium">
                                            {row.personName}
                                        </span>
                                        <span className="block text-xs text-muted-foreground">
                                            {row.roles
                                                .map((key) => ROLE_LABELS[key])
                                                .join(", ")}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <span className="inline-flex items-center gap-2.5">
                                            <Meter
                                                percentage={row.attendancePct}
                                                className="hidden w-20 sm:block"
                                            />
                                            <b className="w-11 font-semibold tabular-nums">
                                                {formatPct(row.attendancePct)}
                                            </b>
                                        </span>
                                    </TableCell>
                                    {COLUMNS.slice(2).map((column) => (
                                        <TableCell
                                            key={column.key}
                                            className={cn(
                                                "text-right tabular-nums",
                                                column.key === "extraHelp" &&
                                                    "pr-4",
                                                row[column.key] === 0 &&
                                                    "text-faint"
                                            )}
                                        >
                                            {row[column.key]}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
};

export default AttendanceStatistics;
