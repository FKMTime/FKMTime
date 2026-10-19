import { ArrowDown, ArrowUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import LoadingPage from "@/Components/LoadingPage";
import EmptyState from "@/Components/shared/EmptyState";
import SearchInput from "@/Components/shared/SearchInput";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { getAttendanceStatistics } from "@/lib/attendance";
import { AttendanceStatistics as Statistic } from "@/lib/interfaces";
import { cn } from "@/lib/utils";

import AttendanceTabs from "../Components/AttendanceTabs";

type SortKey =
    | "personName"
    | "presentPercentage"
    | "totalPresentAtStaffingComparedToRounds"
    | "totalAssignedStaffing";

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
    { key: "personName", label: "Name" },
    { key: "presentPercentage", label: "Attendance", numeric: true },
    {
        key: "totalPresentAtStaffingComparedToRounds",
        label: "Present",
        numeric: true,
    },
    { key: "totalAssignedStaffing", label: "Assigned", numeric: true },
];

/** success from 90%, warning from 70%, below that destructive */
const attendanceTone = (percentage: number) =>
    percentage >= 90
        ? "bg-success"
        : percentage >= 70
          ? "bg-warning"
          : "bg-destructive";

const AttendanceStatistics = () => {
    const [statistics, setStatistics] = useState<Statistic[] | null>(null);
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({
        key: "presentPercentage",
        descending: false,
    });

    useEffect(() => {
        getAttendanceStatistics().then(setStatistics);
    }, []);

    const rows = useMemo(() => {
        const query = search.trim().toLowerCase();
        const filtered = (statistics ?? []).filter((row) =>
            row.personName.toLowerCase().includes(query)
        );
        const sorted = [...filtered].sort((a, b) => {
            const left = a[sort.key];
            const right = b[sort.key];
            return typeof left === "number" && typeof right === "number"
                ? left - right
                : String(left).localeCompare(String(right));
        });
        return sort.descending ? sorted.reverse() : sorted;
    }, [statistics, search, sort]);

    if (!statistics) return <LoadingPage />;

    const present = statistics.reduce(
        (sum, row) => sum + row.totalPresentAtStaffingComparedToRounds,
        0
    );
    const expected = statistics.reduce(
        (sum, row) => sum + row.totalStaffingComparedToRounds,
        0
    );

    const toggleSort = (key: SortKey) =>
        setSort((current) => ({
            key,
            descending: current.key === key ? !current.descending : false,
        }));

    return (
        <div className="flex flex-col gap-4">
            <AttendanceTabs value="statistics" />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <SearchInput
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    label="Search staff"
                />
                <p className="text-sm text-muted-foreground">
                    {expected
                        ? `${Math.round((present / expected) * 100)}% staffing attendance · ${present} of ${expected} assignments`
                        : "No finished groups yet"}
                </p>
            </div>

            {rows.length === 0 ? (
                <EmptyState>No staffing assignments yet.</EmptyState>
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
                                            column.key === "personName" &&
                                                "pl-4 md:pl-5",
                                            column.numeric && "text-right"
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
                                <TableRow key={row.personName}>
                                    <TableCell className="pl-4 font-medium md:pl-5">
                                        {row.personName}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <span className="inline-flex items-center gap-2.5">
                                            <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-track sm:block">
                                                <span
                                                    className={cn(
                                                        "block h-full rounded-full",
                                                        attendanceTone(
                                                            row.presentPercentage
                                                        )
                                                    )}
                                                    style={{
                                                        width: `${Math.min(100, row.presentPercentage)}%`,
                                                    }}
                                                />
                                            </span>
                                            <b className="w-11 font-semibold">
                                                {Math.round(
                                                    row.presentPercentage
                                                )}
                                                %
                                            </b>
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {
                                            row.totalPresentAtStaffingComparedToRounds
                                        }
                                    </TableCell>
                                    <TableCell className="pr-4 text-right">
                                        {row.totalAssignedStaffing}
                                    </TableCell>
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
