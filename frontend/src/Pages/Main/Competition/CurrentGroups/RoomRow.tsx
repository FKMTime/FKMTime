import {
    ArrowLeftRight,
    MoreHorizontal,
    SkipBack,
    Square,
    X,
} from "lucide-react";
import { useState } from "react";
import { Competition as WCIF } from "wcif-helpers";

import ProgressBar from "@/Components/shared/ProgressBar";
import { StatusBadge } from "@/Components/shared/StatusBadge";
import { Button } from "@/Components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import { useConfirm } from "@/hooks/useConfirm";
import { getPreviousGroupsFromScheduleForRoom } from "@/lib/competition";
import { canAddGroup, roundLabel, shortGroupLabel } from "@/lib/currentGroups";
import { getEventIconClass } from "@/lib/events";
import { Room } from "@/lib/interfaces";
import { GroupProgress, isGroupDone } from "@/lib/rooms";
import {
    findGroupSchedule,
    formatTimeRange,
    getGroupPlaceLabel,
    getRoomScheduleStatus,
    isLastGroupInRoom,
} from "@/lib/schedule";
import { cn } from "@/lib/utils";

import GroupPicker from "./groupPicker/GroupPicker";

/** Room · Running now · Results · Next up · actions, from md up */
const COLUMNS =
    "md:grid md:grid-cols-[150px_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.1fr)_auto] md:items-center md:gap-5";

/** Column names above the rows; phones label each card instead */
export const RoomTableHeader = () => (
    <div
        aria-hidden
        className={cn(
            "hidden px-5 py-2.5 text-xs font-medium text-muted-foreground",
            COLUMNS
        )}
    >
        <span>Room</span>
        <span>Running now</span>
        <span>Results</span>
        <span>Next up</span>
        <span className="w-[224px]" />
    </div>
);

interface RoomRowProps {
    room: Room;
    /** Every room, so the picker can say where other groups run */
    rooms: Room[];
    wcif: WCIF;
    /** The groups "Start" moves the room to, from the schedule */
    nextGroupIds: string[];
    getProgress: (roomId: string, groupId: string) => GroupProgress | undefined;
    isAutoChange: boolean;
    now: Date;
    onSetGroups: (room: Room, groupIds: string[]) => Promise<boolean>;
}

const isSameRound = (groupIds: string[], groupId: string) =>
    groupIds.some((id) => groupId.startsWith(`${id.split("-g")[0]}-g`));

/** "Start group 5", or the group's short name when the round changes */
const getStartLabel = (groupIds: string[], next: string[]) => {
    if (next.length === 0) return null;
    if (next.length > 1) return "Start next groups";
    return isSameRound(groupIds, next[0])
        ? `Start group ${next[0].split("-g")[1]}`
        : `Start ${shortGroupLabel(next[0])}`;
};

const RoomRow = ({
    room,
    rooms,
    wcif,
    nextGroupIds,
    getProgress,
    isAutoChange,
    now,
    onSetGroups,
}: RoomRowProps) => {
    const confirm = useConfirm();
    const [isChanging, setIsChanging] = useState(false);
    const [pickedGroupId, setPickedGroupId] = useState<string>();

    const groups = room.currentGroupIds;
    const allDone =
        groups.length === 0 ||
        groups.every((id) => isGroupDone(getProgress(room.id, id)));
    const status = getRoomScheduleStatus(
        wcif,
        room.name,
        groups,
        nextGroupIds,
        now
    );
    const nextSchedule = nextGroupIds[0]
        ? findGroupSchedule(wcif, nextGroupIds[0], room.name)
        : undefined;
    const isRoundChange =
        nextGroupIds.length > 0 && !isSameRound(groups, nextGroupIds[0]);
    const startLabel = getStartLabel(groups, nextGroupIds);

    const ask = async (
        title: string,
        confirmLabel: string,
        variant: "default" | "destructive" = "default"
    ) => {
        try {
            await confirm({
                title,
                description:
                    "Stations in this room switch to the new groups right away.",
                confirmLabel,
                variant,
            });
            return true;
        } catch {
            return false;
        }
    };

    const startGroups = async (groupIds: string[], label: string) => {
        if (await ask(`${label} in ${room.name}?`, label))
            await onSetGroups(room, groupIds);
    };

    const closeChange = () => {
        setIsChanging(false);
        setPickedGroupId(undefined);
    };

    const handlePick = async (groupId: string) => {
        if (groups.length > 0) {
            setPickedGroupId(groupId);
            return;
        }
        const label = `Start ${shortGroupLabel(groupId)}`;
        if (!(await ask(`${label} in ${room.name}?`, label))) return;
        if (await onSetGroups(room, [groupId])) closeChange();
    };

    const applyPicked = async (groupIds: string[]) => {
        if (await onSetGroups(room, groupIds)) closeChange();
    };

    const handleBack = async () => {
        const previous: string[] = await getPreviousGroupsFromScheduleForRoom(
            room.id,
            groups
        );
        if (previous.length > 0)
            startGroups(
                previous,
                `Start ${previous.map(shortGroupLabel).join(" + ")}`
            );
    };

    const stopGroup = async (groupId: string) => {
        const label = `Stop ${shortGroupLabel(groupId)}`;
        if (await ask(`${label} in ${room.name}?`, label, "destructive"))
            await onSetGroups(
                room,
                groups.filter((id) => id !== groupId)
            );
    };

    const stopRoom = async () => {
        if (
            await ask(
                `Stop every group in ${room.name}?`,
                "Stop the room",
                "destructive"
            )
        )
            await onSetGroups(room, []);
    };

    const picked = pickedGroupId;
    const canRunAll = picked ? canAddGroup(groups, picked) : false;
    const runAllLabel =
        groups.length === 1 ? "Run both" : `Run all ${groups.length + 1}`;

    const decisionNode = picked ? (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <p className="text-sm">
                <b className="font-semibold">
                    {roundLabel(picked)} · Group {picked.split("-g")[1]}
                </b>
            </p>
            <div className="flex flex-wrap gap-2">
                <Button onClick={() => applyPicked([picked])}>
                    Switch to {shortGroupLabel(picked)}
                </Button>
                <Button
                    variant="outline"
                    disabled={!canRunAll}
                    onClick={() => applyPicked([...groups, picked])}
                >
                    {runAllLabel}
                </Button>
                <Button variant="ghost" onClick={closeChange}>
                    Cancel
                </Button>
            </div>
            <p className="text-[13px] text-muted-foreground">
                {canRunAll
                    ? `Stations in this room will accept results for ${groups.length === 1 ? "both groups" : "all of them"}.`
                    : "A room runs one group of an event at a time, so this one can only replace it."}
            </p>
        </div>
    ) : undefined;

    const pickerProps = {
        wcif,
        room,
        rooms,
        getProgress,
        nextGroupIds,
        pickedGroupId: picked,
        onClearPick: () => setPickedGroupId(undefined),
        onPick: handlePick,
        onCancel: closeChange,
    };

    return (
        <section
            aria-label={room.name}
            className={cn(
                "flex flex-col gap-3 rounded-mobile-card border bg-card p-4 md:rounded-none md:border-0 md:border-t md:bg-transparent md:px-5 md:py-4",
                COLUMNS
            )}
        >
            {/* Room */}
            <div className="flex items-center justify-between gap-2 md:flex-col md:items-start md:gap-1.5">
                <h2 className="flex items-center gap-2 text-base font-bold">
                    <span
                        aria-hidden
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: room.color }}
                    />
                    {room.name}
                </h2>
                {status && (
                    <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                )}
            </div>

            {/* Running now */}
            <div className="flex flex-col gap-2.5">
                <span className="text-xs font-medium text-muted-foreground md:hidden">
                    Running now
                </span>
                {groups.length === 0 && (
                    <span className="text-[15px] font-semibold text-muted-foreground">
                        Nothing running
                    </span>
                )}
                {groups.map((groupId) => {
                    const schedule = findGroupSchedule(
                        wcif,
                        groupId,
                        room.name
                    );
                    return (
                        <div
                            key={groupId}
                            className="flex items-center gap-2.5"
                        >
                            <span
                                aria-hidden
                                className={cn(
                                    "cubing-icon text-xl",
                                    getEventIconClass(groupId.split("-r")[0])
                                )}
                            />
                            <div className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate text-[15px] font-semibold">
                                    {roundLabel(groupId)}
                                </span>
                                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
                                    {schedule
                                        ? getGroupPlaceLabel(schedule)
                                        : `Group ${groupId.split("-g")[1]}`}
                                    {schedule &&
                                        isLastGroupInRoom(schedule) && (
                                            <StatusBadge tone="warning">
                                                Last group of the round
                                            </StatusBadge>
                                        )}
                                </span>
                            </div>
                            {groups.length > 1 && (
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={`Stop ${shortGroupLabel(groupId)}`}
                                    title={`Stop ${shortGroupLabel(groupId)}`}
                                    onClick={() => stopGroup(groupId)}
                                >
                                    <X />
                                </Button>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Results */}
            <div className="flex flex-col gap-3">
                {groups.map((groupId) => {
                    const progress = getProgress(room.id, groupId);
                    if (!progress || progress.expected === 0)
                        return (
                            <span
                                key={groupId}
                                className="text-[13px] text-muted-foreground"
                            >
                                No competitors assigned
                            </span>
                        );
                    return (
                        <div key={groupId} className="flex flex-col gap-1.5">
                            <span className="text-[13px]">
                                <b className="font-semibold">
                                    {progress.entered}
                                </b>
                                <span className="text-muted-foreground">
                                    /{progress.expected}
                                </span>
                            </span>
                            <ProgressBar
                                value={progress.entered}
                                max={progress.expected}
                                label={`Results entered for ${shortGroupLabel(groupId)}`}
                            />
                            {isGroupDone(progress) && (
                                <span className="text-xs font-medium text-success">
                                    {isAutoChange
                                        ? "All in · moving on by itself"
                                        : "All in · ready for the next group"}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Next up */}
            <div className="flex flex-col gap-0.5 text-sm">
                <span className="text-xs font-medium text-muted-foreground md:hidden">
                    Next up
                </span>
                {nextGroupIds.length === 0 ? (
                    <span className="text-muted-foreground">
                        Nothing left today
                    </span>
                ) : (
                    <>
                        <span className="font-semibold">
                            {nextGroupIds.map(shortGroupLabel).join(" + ")}
                        </span>
                        {nextSchedule && (
                            <span className="text-[13px] text-muted-foreground">
                                {groups.length > 0 &&
                                    isRoundChange &&
                                    "New round · "}
                                {formatTimeRange(
                                    nextSchedule.startTime,
                                    nextSchedule.endTime,
                                    nextSchedule.timezone
                                )}
                            </span>
                        )}
                    </>
                )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 md:justify-end">
                {startLabel && (
                    <Button
                        className="flex-1 md:w-44 md:flex-none"
                        variant={allDone ? "default" : "outline"}
                        onClick={() => startGroups(nextGroupIds, startLabel)}
                    >
                        {startLabel}
                    </Button>
                )}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            size="icon"
                            aria-label={`More for ${room.name}`}
                            className={cn(!startLabel && "max-md:flex-1")}
                        >
                            <MoreHorizontal />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setIsChanging(true)}>
                            <ArrowLeftRight />
                            Change group…
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            disabled={groups.length === 0}
                            onSelect={handleBack}
                        >
                            <SkipBack />
                            Back to the previous group
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            disabled={groups.length === 0}
                            className="text-destructive"
                            onSelect={stopRoom}
                        >
                            <Square />
                            Stop the room
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {isChanging && (
                // The dialog renders over the page; this holds the phone panel
                <div className="md:contents">
                    <GroupPicker {...pickerProps} decision={decisionNode} />
                </div>
            )}
        </section>
    );
};

export default RoomRow;
