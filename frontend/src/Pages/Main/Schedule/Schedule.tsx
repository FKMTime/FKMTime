import { useAtomValue } from "jotai";
import { CalendarDays } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Competition as WCIF } from "wcif-helpers";

import LoadingPage from "@/Components/LoadingPage";
import EmptyState from "@/Components/shared/EmptyState";
import InlineError from "@/Components/shared/InlineError";
import SectionLoading from "@/Components/shared/SectionLoading";
import SegmentedControl from "@/Components/shared/SegmentedControl";
import { StatusBadge } from "@/Components/shared/StatusBadge";
import { Button } from "@/Components/ui/button";
import { getActivityName } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";
import { getRoomActivities } from "@/lib/competition";
import { getEventIconClass } from "@/lib/events";
import { Activity } from "@/lib/interfaces";
import {
    isDelegate,
    isStageLeaderOrOrganizerOrDelegate,
} from "@/lib/permissions";
import {
    competitionDayToQueryDate,
    formatCompetitionDay,
    formatRealTime,
    formatTimeRange,
    getCompetitionDays,
    getDefaultCompetitionDay,
    getScheduleRooms,
    getScheduleRoundDetails,
    ScheduleRoom,
} from "@/lib/schedule";
import { cn } from "@/lib/utils";

// Literal class strings, so Tailwind sees both; the second adds the links column
const ROW_GRID =
    "grid grid-cols-[110px_110px_minmax(180px,1.6fr)_minmax(110px,1fr)_minmax(110px,1fr)_minmax(110px,1fr)_minmax(100px,1fr)_60px] gap-4 px-5";
const ROW_GRID_WITH_LINKS =
    "grid grid-cols-[110px_110px_minmax(180px,1.6fr)_minmax(110px,1fr)_minmax(110px,1fr)_minmax(110px,1fr)_minmax(100px,1fr)_60px_180px] gap-4 px-5";

interface Loaded {
    /** Room and day the activities belong to */
    key: string;
    activities?: Activity[];
    error?: string;
}

const isOngoing = (activity: Activity, now: Date) =>
    new Date(activity.startTime) <= now && now < new Date(activity.endTime);

const ActivityName = ({ activity }: { activity: Activity }) => {
    const isOther = activity.activityCode.startsWith("other");
    return (
        <span className="flex min-w-0 items-center gap-2 font-semibold">
            {!isOther && (
                <span
                    aria-hidden
                    className={cn(
                        "cubing-icon text-[17px]",
                        getEventIconClass(activity.activityCode.split("-")[0])
                    )}
                />
            )}
            <span className="truncate">
                {getActivityName(activity).replace(", ", " · ")}
            </span>
        </span>
    );
};

interface ActivityLinksProps {
    activity: Activity;
    showResults: boolean;
    showAttendance: boolean;
}

const ActivityLinks = ({
    activity,
    showResults,
    showAttendance,
}: ActivityLinksProps) => {
    const firstGroup = activity.childActivities[0]?.activityCode;
    return (
        <span className="flex gap-1">
            {showResults && (
                <Button asChild variant="ghost" size="sm">
                    <Link to={`/results/round/${activity.activityCode}`}>
                        Results
                    </Link>
                </Button>
            )}
            {showAttendance && firstGroup && (
                <Button asChild variant="ghost" size="sm">
                    <Link to={`/attendance/${firstGroup}`}>Attendance</Link>
                </Button>
            )}
        </span>
    );
};

const Schedule = () => {
    const competition = useAtomValue(competitionAtom);
    const wcif = competition?.wcif as WCIF | undefined;

    const rooms = useMemo(() => (wcif ? getScheduleRooms(wcif) : []), [wcif]);
    const days = useMemo(
        () =>
            wcif
                ? getCompetitionDays(
                      wcif.schedule.startDate,
                      wcif.schedule.numberOfDays
                  )
                : [],
        [wcif]
    );

    const [chosenRoomKey, setChosenRoomKey] = useState<string>();
    const [chosenDay, setChosenDay] = useState<string>();
    const room: ScheduleRoom | undefined =
        rooms.find((r) => r.key === chosenRoomKey) ?? rooms[0];
    const day =
        chosenDay && days.includes(chosenDay)
            ? chosenDay
            : getDefaultCompetitionDay(days);

    const requestKey = room && day ? `${room.key}|${day}` : undefined;
    const [loaded, setLoaded] = useState<Loaded>();

    useEffect(() => {
        if (!room || !day || !requestKey) return;
        let cancelled = false;
        getRoomActivities(
            room.venueId,
            room.roomId,
            competitionDayToQueryDate(day)
        )
            .then((activities) => {
                if (!cancelled) setLoaded({ key: requestKey, activities });
            })
            .catch((error: Error) => {
                if (!cancelled)
                    setLoaded({ key: requestKey, error: error.message });
            });
        return () => {
            cancelled = true;
        };
    }, [room, day, requestKey]);

    if (!competition || !wcif) return <LoadingPage />;

    const showResults = competition.useFkmTimeDevices && isDelegate();
    const showAttendance = isStageLeaderOrOrganizerOrDelegate();
    const showLinks = showResults || showAttendance;
    const rowGrid = showLinks ? ROW_GRID_WITH_LINKS : ROW_GRID;
    const current = loaded?.key === requestKey ? loaded : undefined;
    const now = new Date();

    const renderActivities = () => {
        if (!requestKey)
            return (
                <EmptyState icon={<CalendarDays />}>
                    The competition has no schedule yet
                </EmptyState>
            );
        if (!current) return <SectionLoading label="Loading schedule" />;
        if (current.error) return <InlineError>{current.error}</InlineError>;
        const activities = current.activities ?? [];
        if (!activities.length)
            return (
                <EmptyState icon={<CalendarDays />}>
                    Nothing scheduled in this room on this day
                </EmptyState>
            );

        const rows = activities.map((activity) => ({
            activity,
            details: getScheduleRoundDetails(activity.activityCode, wcif),
            scheduled: formatTimeRange(
                activity.startTime,
                activity.endTime,
                room?.timezone
            ),
            real: formatRealTime(
                activity.realStartTime,
                activity.realEndTime,
                room?.timezone
            ),
            ongoing: isOngoing(activity, now),
            groups: activity.childActivities.length,
        }));

        return (
            <>
                <ul className="overflow-hidden rounded-mobile-card border bg-card md:hidden">
                    {rows.map(
                        ({
                            activity,
                            details,
                            scheduled,
                            real,
                            ongoing,
                            groups,
                        }) => (
                            <li
                                key={activity.id}
                                className="flex flex-col gap-1.5 border-b px-3.5 py-3 last:border-b-0"
                            >
                                <div className="flex items-center gap-2 text-[15px]">
                                    <span className="min-w-0 flex-1">
                                        <ActivityName activity={activity} />
                                    </span>
                                    {ongoing && (
                                        <StatusBadge tone="primary" withDot>
                                            Now
                                        </StatusBadge>
                                    )}
                                </div>
                                <span className="text-sm">
                                    {scheduled}
                                    {real && (
                                        <span className="text-muted-foreground">
                                            {" "}
                                            · Real {real}
                                        </span>
                                    )}
                                </span>
                                {details && (
                                    <span className="text-xs text-muted-foreground">
                                        {[
                                            details.format,
                                            details.timeLimit &&
                                                `Time limit ${details.timeLimit}`,
                                            details.cutoff &&
                                                `Cutoff ${details.cutoff}`,
                                            details.proceeds &&
                                                `Proceed ${details.proceeds}`,
                                            groups > 0 &&
                                                `${groups} ${groups === 1 ? "group" : "groups"}`,
                                        ]
                                            .filter(Boolean)
                                            .join(" · ")}
                                    </span>
                                )}
                                {details && showLinks && (
                                    <div className="-ml-3">
                                        <ActivityLinks
                                            activity={activity}
                                            showResults={showResults}
                                            showAttendance={showAttendance}
                                        />
                                    </div>
                                )}
                            </li>
                        )
                    )}
                </ul>
                <div className="hidden overflow-x-auto rounded-2xl border bg-card md:block">
                    <div
                        className={cn(
                            rowGrid,
                            "min-w-max py-2.5 text-xs font-semibold text-muted-foreground"
                        )}
                    >
                        <span>Scheduled</span>
                        <span title="From the first to the last device attempt of the round">
                            Real
                        </span>
                        <span>Activity</span>
                        <span>Format</span>
                        <span>Time limit</span>
                        <span>Cutoff</span>
                        <span>Proceed</span>
                        <span className="text-right">Groups</span>
                        {showLinks && <span />}
                    </div>
                    {rows.map(
                        ({
                            activity,
                            details,
                            scheduled,
                            real,
                            ongoing,
                            groups,
                        }) => (
                            <div
                                key={activity.id}
                                className={cn(
                                    rowGrid,
                                    "min-h-11 min-w-max items-center border-t text-sm",
                                    ongoing && "bg-primary-soft"
                                )}
                            >
                                <span className="font-semibold tabular-nums">
                                    {scheduled}
                                </span>
                                <span className="text-muted-foreground tabular-nums">
                                    {real}
                                </span>
                                <ActivityName activity={activity} />
                                <span className="text-muted-foreground">
                                    {details?.format}
                                </span>
                                <span
                                    className="truncate text-muted-foreground"
                                    title={details?.timeLimit}
                                >
                                    {details?.timeLimit}
                                </span>
                                <span
                                    className="truncate text-muted-foreground"
                                    title={details?.cutoff}
                                >
                                    {details?.cutoff}
                                </span>
                                <span className="text-muted-foreground">
                                    {details?.proceeds}
                                </span>
                                <span className="text-right text-muted-foreground">
                                    {groups || ""}
                                </span>
                                {showLinks && (
                                    <span className="flex justify-end">
                                        {details && (
                                            <ActivityLinks
                                                activity={activity}
                                                showResults={showResults}
                                                showAttendance={showAttendance}
                                            />
                                        )}
                                    </span>
                                )}
                            </div>
                        )
                    )}
                </div>
            </>
        );
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2.5 md:flex-row md:flex-wrap md:items-center md:gap-3">
                {days.length > 1 && day && (
                    <SegmentedControl
                        label="Day"
                        value={day}
                        onValueChange={setChosenDay}
                        options={days.map((d) => ({
                            value: d,
                            label: formatCompetitionDay(d),
                        }))}
                    />
                )}
                {rooms.length > 1 && room && (
                    <SegmentedControl
                        label="Room"
                        value={room.key}
                        onValueChange={setChosenRoomKey}
                        options={rooms.map((r) => ({
                            value: r.key,
                            label: r.label,
                        }))}
                    />
                )}
            </div>
            {renderActivities()}
        </div>
    );
};

export default Schedule;
