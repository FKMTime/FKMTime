import { CalendarCheck, CalendarX } from "lucide-react";
import { Link } from "react-router-dom";

import EmptyState from "@/Components/shared/EmptyState";
import { StatusTone } from "@/Components/shared/status";
import { StatusBadge } from "@/Components/shared/StatusBadge";
import { Button } from "@/Components/ui/button";
import { prettyStaffActivityStatus } from "@/lib/attendance";
import { getEventIconClass } from "@/lib/events";
import { StaffActivityStatus } from "@/lib/interfaces";
import { groupScheduleByDay, PersonScheduleEntry } from "@/lib/personSchedule";
import { formatCompetitionDay, formatTimeRange } from "@/lib/schedule";
import { cn } from "@/lib/utils";

const ATTENDANCE_TONE: Record<StaffActivityStatus, StatusTone> = {
    [StaffActivityStatus.PRESENT]: "success",
    [StaffActivityStatus.LATE]: "warning",
    [StaffActivityStatus.REPLACED]: "neutral",
    [StaffActivityStatus.ABSENT]: "destructive",
};

interface PersonScheduleProps {
    entries: PersonScheduleEntry[];
    /** Links each group to its attendance page */
    canOpenAttendance: boolean;
    /** Offers "Not coming" for a day with staffing still to come */
    onSetNoShow?: (day: string, noShow: boolean) => void;
    now?: Date;
}

const isOngoing = (entry: PersonScheduleEntry, now: Date) =>
    new Date(entry.startTime) <= now && now < new Date(entry.endTime);

const attendanceLabel = (entry: PersonScheduleEntry) => {
    if (!entry.attendance) return null;
    if (entry.noShow) return "Not coming";
    if (
        entry.attendance === StaffActivityStatus.REPLACED &&
        entry.replacedByName
    )
        return `Replaced by ${entry.replacedByName}`;
    return prettyStaffActivityStatus(entry.attendance);
};

const PersonSchedule = ({
    entries,
    canOpenAttendance,
    onSetNoShow,
    now = new Date(),
}: PersonScheduleProps) => {
    if (entries.length === 0)
        return <EmptyState>No assignments in the schedule.</EmptyState>;

    return (
        <div className="flex flex-col gap-5">
            {groupScheduleByDay(entries).map(({ day, entries: dayEntries }) => (
                <section key={day} className="flex flex-col gap-2">
                    <div className="flex min-h-8 items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-muted-foreground">
                            {formatCompetitionDay(day)}
                        </h3>
                        {onSetNoShow &&
                            dayNoShowAction(dayEntries, now, (noShow) =>
                                onSetNoShow(day, noShow)
                            )}
                    </div>
                    <ul className="flex flex-col divide-y overflow-hidden rounded-mobile-card border bg-card md:rounded-2xl">
                        {dayEntries.map((entry) => {
                            const isOther =
                                entry.activityCode.startsWith("other");
                            const isGroup = entry.activityCode.includes("-g");
                            const ongoing = isOngoing(entry, now);
                            const details = [
                                entry.roomName,
                                entry.stationNumber &&
                                    `Station ${entry.stationNumber}`,
                                !entry.isAssigned && "Not assigned",
                            ].filter(Boolean);
                            const name =
                                canOpenAttendance && isGroup && !isOther ? (
                                    <Link
                                        to={`/attendance/${entry.activityCode}`}
                                        className="hover:underline"
                                    >
                                        {entry.name}
                                    </Link>
                                ) : (
                                    entry.name
                                );
                            return (
                                <li
                                    key={entry.key}
                                    aria-current={ongoing || undefined}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 md:gap-6 md:px-5",
                                        ongoing && "bg-primary-soft"
                                    )}
                                >
                                    <span className="w-24 shrink-0 text-sm tabular-nums text-muted-foreground">
                                        {formatTimeRange(
                                            entry.startTime,
                                            entry.endTime,
                                            entry.timezone
                                        )}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="flex min-w-0 items-center gap-2 font-semibold">
                                            {!isOther && (
                                                <span
                                                    aria-hidden
                                                    className={cn(
                                                        "cubing-icon text-[17px]",
                                                        getEventIconClass(
                                                            entry.activityCode.split(
                                                                "-"
                                                            )[0]
                                                        )
                                                    )}
                                                />
                                            )}
                                            <span className="truncate">
                                                {name}
                                            </span>
                                        </p>
                                        {details.length > 0 && (
                                            <p className="truncate text-[13px] text-muted-foreground">
                                                {details.join(" · ")}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                                        <StatusBadge
                                            tone={
                                                entry.isCompetitor
                                                    ? "primary"
                                                    : "neutral"
                                            }
                                        >
                                            {entry.role}
                                        </StatusBadge>
                                        {entry.attendance && (
                                            <StatusBadge
                                                tone={
                                                    ATTENDANCE_TONE[
                                                        entry.attendance
                                                    ]
                                                }
                                            >
                                                {attendanceLabel(entry)}
                                            </StatusBadge>
                                        )}
                                        {entry.leftEarly && (
                                            <StatusBadge tone="warning">
                                                Left early
                                            </StatusBadge>
                                        )}
                                        {entry.attendance ===
                                            StaffActivityStatus.ABSENT &&
                                            entry.replacedByName && (
                                                <StatusBadge tone="neutral">
                                                    Covered by{" "}
                                                    {entry.replacedByName}
                                                </StatusBadge>
                                            )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            ))}
        </div>
    );
};

/** "Not coming" while the day has staffing to come, or undo it */
const dayNoShowAction = (
    entries: PersonScheduleEntry[],
    now: Date,
    onSetNoShow: (noShow: boolean) => void
) => {
    const upcoming = entries.filter(
        (entry) => !entry.isCompetitor && new Date(entry.endTime) > now
    );
    if (upcoming.length === 0) return null;
    return upcoming.some((entry) => entry.noShow) ? (
        <Button variant="ghost" size="sm" onClick={() => onSetNoShow(false)}>
            <CalendarCheck />
            Coming after all
        </Button>
    ) : (
        <Button variant="ghost" size="sm" onClick={() => onSetNoShow(true)}>
            <CalendarX />
            Not coming
        </Button>
    );
};

export default PersonSchedule;
