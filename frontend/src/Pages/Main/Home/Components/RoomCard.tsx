import { Link } from "react-router-dom";
import { Competition as WCIF } from "wcif-helpers";

import ProgressBar from "@/Components/shared/ProgressBar";
import { StatusBadge, StatusDot } from "@/Components/shared/StatusBadge";
import { Button } from "@/Components/ui/button";
import { getEventIdFromRoundId } from "@/lib/activities";
import { activityCodeToName } from "@/lib/activities";
import { getEventIconClass } from "@/lib/events";
import { Attempt, AttemptType, Incident, Room } from "@/lib/interfaces";
import { attemptWithPenaltyToString } from "@/lib/resultFormatters";
import { GroupProgress } from "@/lib/rooms";
import {
    findGroupSchedule,
    formatTimeRange,
    getNextActivityInRoom,
    getScheduleStatus,
    getStartLabel,
} from "@/lib/schedule";
import { cn } from "@/lib/utils";

export interface RecentAttempt extends Attempt {
    result: {
        id: string;
        person: { id: string; name: string };
    };
}

interface RoomCardProps {
    room: Room;
    wcif: WCIF;
    progress: GroupProgress[];
    incidents: Incident[];
    recentAttempts: Record<string, RecentAttempt[]>;
    /** Groups the next "Start" moves the room to; undefined hides the button */
    nextGroupIds?: string[];
    now: Date;
    /** The mobile room switcher already names the room */
    isRoomNamedElsewhere?: boolean;
    canEnterAttempts: boolean;
    canOpenAttendance: boolean;
    canResolveIncidents: boolean;
    onStartNext: (room: Room, nextGroupIds: string[]) => void;
    onEnterAttempt: (roundId: string) => void;
}

const RoomCard = ({
    room,
    wcif,
    progress,
    incidents,
    recentAttempts,
    nextGroupIds,
    now,
    isRoomNamedElsewhere,
    canEnterAttempts,
    canOpenAttendance,
    canResolveIncidents,
    onStartNext,
    onEnterAttempt,
}: RoomCardProps) => {
    const groupId = room.currentGroupIds[0];
    const schedule = groupId
        ? findGroupSchedule(wcif, groupId, room.name)
        : undefined;
    const roundId = groupId?.split("-g")[0];
    const groupProgress = progress.find((p) => p.groupId === groupId);
    // Starting the next group is the main action only once this one is done
    const isGroupDone =
        !groupId ||
        (!!groupProgress &&
            groupProgress.expected > 0 &&
            groupProgress.entered >= groupProgress.expected);
    const recent = roundId ? recentAttempts[roundId] ?? [] : [];
    const startLabel = nextGroupIds
        ? getStartLabel(room.currentGroupIds, nextGroupIds)
        : null;
    const nextActivity = getNextActivityInRoom(
        wcif,
        room.name,
        schedule?.roundEndTime ?? now.toISOString()
    );
    const scheduleStatus = schedule
        ? getScheduleStatus(
              schedule.startTime,
              schedule.endTime,
              schedule.timezone,
              now
          )
        : null;

    return (
        <section
            aria-label={room.name}
            className="flex flex-col gap-4 md:gap-5 md:rounded-2xl md:border md:bg-card md:p-[22px]"
        >
            <div className="flex flex-col gap-4 rounded-mobile-card border bg-card p-4 md:contents">
                <header
                    className={cn(
                        "flex items-center justify-between gap-3",
                        isRoomNamedElsewhere && "max-md:hidden"
                    )}
                >
                    <h2 className="text-sm font-medium text-muted-foreground">
                        {room.name}
                    </h2>
                    {scheduleStatus && (
                        <StatusBadge tone={scheduleStatus.tone}>
                            {scheduleStatus.label}
                        </StatusBadge>
                    )}
                </header>

                {groupId && roundId ? (
                    <div className="flex items-start gap-3">
                        <span
                            aria-hidden
                            className={cn(
                                "cubing-icon mt-0.5 text-[28px]",
                                getEventIconClass(
                                    getEventIdFromRoundId(roundId)
                                )
                            )}
                        />
                        <div className="min-w-0 flex-1">
                            <h3 className="text-[19px] font-bold leading-tight md:text-xl">
                                {activityCodeToName(roundId).replace(
                                    ", ",
                                    " · "
                                )}
                            </h3>
                            {schedule && (
                                <p className="mt-0.5 text-sm text-muted-foreground">
                                    Group {schedule.groupNumber} of{" "}
                                    {schedule.groupCount} ·{" "}
                                    {formatTimeRange(
                                        schedule.startTime,
                                        schedule.endTime,
                                        schedule.timezone
                                    )}
                                </p>
                            )}
                        </div>
                        {isRoomNamedElsewhere && scheduleStatus && (
                            <StatusBadge
                                tone={scheduleStatus.tone}
                                className="mt-1 md:hidden"
                            >
                                {scheduleStatus.label}
                            </StatusBadge>
                        )}
                    </div>
                ) : (
                    <p className="py-2 text-[15px] font-semibold text-muted-foreground">
                        No group in progress
                    </p>
                )}

                {groupProgress && groupProgress.expected > 0 && (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                                Results entered
                            </span>
                            <span>
                                <b className="font-semibold">
                                    {groupProgress.entered}
                                </b>
                                <span className="text-muted-foreground">
                                    /{groupProgress.expected}
                                </span>
                            </span>
                        </div>
                        <ProgressBar
                            value={groupProgress.entered}
                            max={groupProgress.expected}
                            label={`Results entered in ${room.name}`}
                        />
                    </div>
                )}

                {(startLabel || canEnterAttempts || canOpenAttendance) && (
                    <div className="order-none flex flex-col gap-2.5 md:order-last md:gap-3">
                        {startLabel && nextGroupIds && isGroupDone && (
                            <Button
                                size="lg"
                                onClick={() => onStartNext(room, nextGroupIds)}
                            >
                                {startLabel}
                            </Button>
                        )}
                        {groupId &&
                            roundId &&
                            (canEnterAttempts || canOpenAttendance) && (
                                <div className="grid grid-cols-2 gap-2.5">
                                    {canEnterAttempts && (
                                        <Button
                                            variant="secondary"
                                            onClick={() =>
                                                onEnterAttempt(roundId)
                                            }
                                            className={cn(
                                                !canOpenAttendance &&
                                                    "col-span-2"
                                            )}
                                        >
                                            Enter attempt
                                        </Button>
                                    )}
                                    {canOpenAttendance && (
                                        <Button
                                            variant="secondary"
                                            asChild
                                            className={cn(
                                                !canEnterAttempts &&
                                                    "col-span-2"
                                            )}
                                        >
                                            <Link to={`/attendance/${groupId}`}>
                                                Attendance
                                            </Link>
                                        </Button>
                                    )}
                                </div>
                            )}
                        {startLabel && nextGroupIds && !isGroupDone && (
                            <Button
                                variant="outline"
                                onClick={() => onStartNext(room, nextGroupIds)}
                            >
                                {startLabel}
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {canResolveIncidents && incidents.length > 0 && (
                <RoomSection title="Incidents" hideTitleOnDesktop>
                    {incidents.map((incident) => (
                        <li
                            key={incident.id}
                            className="flex items-center gap-3 px-4 py-3 md:px-0 md:py-2.5"
                        >
                            <StatusDot tone="destructive" className="size-2" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">
                                    {incident.result.person.name}
                                </p>
                                <p className="truncate text-[13px] text-muted-foreground">
                                    {[
                                        incident.device?.name,
                                        incident.judge &&
                                            `Judge ${incident.judge.name}`,
                                    ]
                                        .filter(Boolean)
                                        .join(" · ")}
                                </p>
                            </div>
                            <Button
                                variant="link"
                                asChild
                                className="h-11 px-2 md:h-8"
                            >
                                <Link to={`/incidents/${incident.id}`}>
                                    Resolve
                                </Link>
                            </Button>
                        </li>
                    ))}
                </RoomSection>
            )}

            {recent.length > 0 && (
                <RoomSection title="Recent results">
                    {recent.map((attempt) => (
                        <li key={attempt.id}>
                            <Link
                                to={`/results/${attempt.result.id}`}
                                className="flex min-h-11 items-center gap-3 px-4 py-2 hover:bg-accent md:-mx-2 md:min-h-0 md:rounded-md md:px-2"
                            >
                                <span className="min-w-0 flex-1 truncate font-medium">
                                    {attempt.result.person.name}
                                </span>
                                <span className="text-muted-foreground">
                                    {attempt.type === AttemptType.EXTRA_ATTEMPT
                                        ? "Extra"
                                        : "Attempt"}{" "}
                                    {attempt.attemptNumber}
                                </span>
                                <b className="min-w-[3.5rem] text-right font-semibold">
                                    {attemptWithPenaltyToString(attempt)}
                                </b>
                            </Link>
                        </li>
                    ))}
                </RoomSection>
            )}

            {nextActivity && (
                <div className="flex items-baseline gap-4 px-1 text-sm md:order-last md:border-t md:px-0 md:pt-4">
                    <span className="text-[13px] text-muted-foreground">
                        Next
                    </span>
                    <div>
                        <p className="font-medium">{nextActivity.name}</p>
                        <p className="text-muted-foreground">
                            {formatTimeRange(
                                nextActivity.startTime,
                                nextActivity.endTime,
                                schedule?.timezone
                            )}
                        </p>
                    </div>
                </div>
            )}
        </section>
    );
};

interface RoomSectionProps {
    title: string;
    hideTitleOnDesktop?: boolean;
    children: React.ReactNode;
}

/** A card with a label on mobile; a divided list inside the room card on desktop */
const RoomSection = ({
    title,
    hideTitleOnDesktop,
    children,
}: RoomSectionProps) => (
    <div className="flex flex-col gap-2 md:gap-1.5 md:border-t md:pt-1">
        <h4
            className={cn(
                "pl-1 text-[13px] font-medium text-muted-foreground md:pl-0 md:pt-3 md:text-xs md:text-faint",
                hideTitleOnDesktop && "md:sr-only"
            )}
        >
            {title}
        </h4>
        <ul className="flex flex-col divide-y overflow-hidden rounded-mobile-card border bg-card text-sm md:rounded-none md:border-0 md:bg-transparent">
            {children}
        </ul>
    </div>
);

export default RoomCard;
