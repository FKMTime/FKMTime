import { useState } from "react";
import { Link } from "react-router-dom";
import { Competition as WCIF } from "wcif-helpers";

import ProgressBar from "@/Components/shared/ProgressBar";
import { StatusBadge, StatusDot } from "@/Components/shared/StatusBadge";
import { Button } from "@/Components/ui/button";
import { getEventIdFromRoundId } from "@/lib/activities";
import { activityCodeToName } from "@/lib/activities";
import { shortGroupLabel } from "@/lib/currentGroups";
import { getEventIconClass } from "@/lib/events";
import {
    AttemptType,
    Device,
    Incident,
    RecentAttempt,
    Room,
} from "@/lib/interfaces";
import { attemptWithPenaltyToString } from "@/lib/resultFormatters";
import { GroupProgress, isGroupDone } from "@/lib/rooms";
import {
    findGroupSchedule,
    formatTimeRange,
    getGroupPlaceLabel,
    getNextActivityInRoom,
    getRoomScheduleStatus,
    getStartLabel,
    isLastGroupInRoom,
} from "@/lib/schedule";
import { cn } from "@/lib/utils";

import ChangeGroup from "./ChangeGroup";
import RoomGroupMenu from "./RoomGroupMenu";

export type { RecentAttempt };

/** What a room card needs to change its groups by hand */
export interface GroupControls {
    /** Every room, so the group picker can say where other groups run */
    rooms: Room[];
    getProgress: (roomId: string, groupId: string) => GroupProgress | undefined;
    /** Rooms move to their next group by themselves once all results are in */
    isAutoChange: boolean;
    onSetGroups: (room: Room, groupIds: string[]) => Promise<boolean>;
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
    /** Stations of this room running another round (SPEC-007) */
    pointedStations?: Device[];
    /** Sends a station back to the room's round; undefined hides the button */
    onBackToRoom?: (station: Device) => void;
    /** Undefined hides the room's "…" menu */
    groupControls?: GroupControls;
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
    pointedStations = [],
    onBackToRoom,
    groupControls,
}: RoomCardProps) => {
    const [isChangingGroup, setIsChangingGroup] = useState(false);
    const groups = room.currentGroupIds;
    const groupId = groups[0];
    const schedule = groupId
        ? findGroupSchedule(wcif, groupId, room.name)
        : undefined;
    const roundId = groupId?.split("-g")[0];
    const progressOf = (id: string) => progress.find((p) => p.groupId === id);
    // Starting the next group is the main action only once these are done
    const areGroupsDone =
        groups.length === 0 ||
        groups.every((id) => isGroupDone(progressOf(id)));
    const recent = roundId ? recentAttempts[roundId] ?? [] : [];
    const startLabel = nextGroupIds
        ? getStartLabel(room.currentGroupIds, nextGroupIds)
        : null;
    const nextActivity = getNextActivityInRoom(
        wcif,
        room.name,
        schedule?.roundEndTime ?? now.toISOString()
    );
    // A running room is never "Starts …"; an empty one shows its next group
    const scheduleStatus = getRoomScheduleStatus(
        wcif,
        room.name,
        room.currentGroupIds,
        nextGroupIds ?? [],
        now
    );

    return (
        <section
            aria-label={room.name}
            className="flex flex-col gap-4 md:gap-5 md:rounded-2xl md:border md:bg-card md:p-[22px]"
        >
            <div className="flex flex-col gap-4 rounded-mobile-card border bg-card p-4 md:contents">
                <header
                    className={cn(
                        "flex items-center gap-3",
                        // The mobile room switcher already names the room
                        isRoomNamedElsewhere &&
                            !scheduleStatus &&
                            !groupControls &&
                            "max-md:hidden"
                    )}
                >
                    <h2
                        className={cn(
                            "flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-muted-foreground",
                            isRoomNamedElsewhere && "max-md:sr-only"
                        )}
                    >
                        <span
                            aria-hidden
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: room.color }}
                        />
                        <span className="truncate">{room.name}</span>
                    </h2>
                    {scheduleStatus && (
                        <StatusBadge tone={scheduleStatus.tone}>
                            {scheduleStatus.label}
                        </StatusBadge>
                    )}
                    {groupControls && (
                        <RoomGroupMenu
                            room={room}
                            onChangeGroup={() => setIsChangingGroup(true)}
                            onSetGroups={groupControls.onSetGroups}
                        />
                    )}
                </header>

                {groupControls && isChangingGroup && (
                    // A dialog from md up; a panel in the card on phones
                    <ChangeGroup
                        room={room}
                        rooms={groupControls.rooms}
                        wcif={wcif}
                        nextGroupIds={nextGroupIds ?? []}
                        getProgress={groupControls.getProgress}
                        onSetGroups={groupControls.onSetGroups}
                        onClose={() => setIsChangingGroup(false)}
                    />
                )}

                {groups.length === 0 && (
                    <p className="py-2 text-[15px] font-semibold text-muted-foreground">
                        No group in progress
                    </p>
                )}
                {groups.map((id) => (
                    <RunningGroup
                        key={id}
                        groupId={id}
                        roomName={room.name}
                        wcif={wcif}
                        progress={progressOf(id)}
                        progressLabel={
                            groups.length === 1
                                ? `Results entered in ${room.name}`
                                : `Results entered for ${shortGroupLabel(id)} in ${room.name}`
                        }
                        actions={
                            // One room, several groups: each gets its own
                            groups.length > 1 &&
                            (canEnterAttempts || canOpenAttendance) && (
                                <div className="flex gap-2">
                                    {canEnterAttempts && (
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            aria-label={`Enter attempt for ${shortGroupLabel(id)}`}
                                            onClick={() =>
                                                onEnterAttempt(
                                                    id.split("-g")[0]
                                                )
                                            }
                                        >
                                            Enter attempt
                                        </Button>
                                    )}
                                    {canOpenAttendance && (
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            asChild
                                        >
                                            <Link
                                                to={`/attendance/${id}`}
                                                aria-label={`Attendance for ${shortGroupLabel(id)}`}
                                            >
                                                Attendance
                                            </Link>
                                        </Button>
                                    )}
                                </div>
                            )
                        }
                    />
                ))}
                {groupControls && groups.length > 0 && areGroupsDone && (
                    <p className="-mt-1 text-xs font-medium text-success">
                        {groupControls.isAutoChange
                            ? "All in · moving on by itself"
                            : "All in · ready for the next group"}
                    </p>
                )}

                {pointedStations.length > 0 && (
                    <ul
                        aria-label="Stations running another round"
                        className="flex flex-col gap-2"
                    >
                        {pointedStations.map((station) => (
                            <li
                                key={station.id}
                                className="flex items-center gap-3 rounded-lg bg-warning-soft px-3 py-2 text-sm"
                            >
                                <span className="min-w-0 flex-1 font-semibold text-warning">
                                    {station.name} is running{" "}
                                    {activityCodeToName(
                                        station.customRoundId ?? ""
                                    ).replace(", ", " · ")}
                                </span>
                                {onBackToRoom && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => onBackToRoom(station)}
                                    >
                                        Back to the room&apos;s round
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}

                {(startLabel || canEnterAttempts || canOpenAttendance) && (
                    <div className="order-0 flex flex-col gap-2.5 md:order-last md:gap-3">
                        {startLabel && nextGroupIds && areGroupsDone && (
                            <Button
                                size="lg"
                                onClick={() => onStartNext(room, nextGroupIds)}
                            >
                                {startLabel}
                            </Button>
                        )}
                        {groups.length === 1 &&
                            groupId &&
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
                        {startLabel && nextGroupIds && !areGroupsDone && (
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
                                <b className="min-w-14 text-right font-semibold">
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

interface RunningGroupProps {
    groupId: string;
    roomName: string;
    wcif: WCIF;
    progress?: GroupProgress;
    progressLabel: string;
    /** The group's own actions, when the room runs several */
    actions?: React.ReactNode;
}

/** A group the room runs: what it is, when, and how many results are in */
const RunningGroup = ({
    groupId,
    roomName,
    wcif,
    progress,
    progressLabel,
    actions,
}: RunningGroupProps) => {
    const roundId = groupId.split("-g")[0];
    const schedule = findGroupSchedule(wcif, groupId, roomName);
    const roundName = activityCodeToName(roundId).replace(", ", " · ");
    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
                <span
                    aria-hidden
                    className={cn(
                        "cubing-icon mt-0.5 text-[28px]",
                        getEventIconClass(getEventIdFromRoundId(roundId))
                    )}
                />
                <div className="min-w-0 flex-1">
                    <h3 className="text-[19px] font-bold leading-tight md:text-xl">
                        {roundName}
                    </h3>
                    {schedule ? (
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                            <span>
                                {getGroupPlaceLabel(schedule)} ·{" "}
                                {formatTimeRange(
                                    schedule.startTime,
                                    schedule.endTime,
                                    schedule.timezone
                                )}
                            </span>
                            {isLastGroupInRoom(schedule) && (
                                <StatusBadge tone="warning">
                                    Last group of the round
                                </StatusBadge>
                            )}
                        </p>
                    ) : (
                        <p className="mt-0.5 text-sm text-muted-foreground">
                            Group {groupId.split("-g")[1]}
                        </p>
                    )}
                </div>
            </div>
            {progress && progress.expected > 0 && (
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                            Results entered
                        </span>
                        <span>
                            <b className="font-semibold">{progress.entered}</b>
                            <span className="text-muted-foreground">
                                /{progress.expected}
                            </span>
                        </span>
                    </div>
                    <ProgressBar
                        value={progress.entered}
                        max={progress.expected}
                        label={progressLabel}
                    />
                </div>
            )}
            {actions}
        </div>
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
