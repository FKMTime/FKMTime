import { useAtom } from "jotai";
import { Info, ListX, Save, SkipBack, SkipForward, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import LoadingPage from "@/Components/LoadingPage";
import EmptyState from "@/Components/shared/EmptyState";
import { Alert } from "@/Components/ui/alert";
import { Button } from "@/Components/ui/button";
import { Label } from "@/Components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";
import {
    getCompetitionInfo,
    getNextGroupsFromScheduleForRoom,
    getPreviousGroupsFromScheduleForRoom,
} from "@/lib/competition";
import {
    canAddGroup,
    describeGroupChanges,
    getGroupLabel,
    getGroupOptions,
    getRoomGroupsError,
    getRoundsToOpen,
} from "@/lib/currentGroups";
import { getEventIconClass, isUnofficialEvent } from "@/lib/events";
import { Room } from "@/lib/interfaces";
import { getAllRooms, updateCurrentRound } from "@/lib/rooms";
import { cn } from "@/lib/utils";
import SetupTabs from "@/Pages/Main/Setup/SetupTabs";

const groupCountLabel = (count: number) =>
    count === 1 ? "1 group" : `${count} groups`;

const CurrentGroups = () => {
    const { toast } = useToast();
    const [competition, setCompetition] = useAtom(competitionAtom);
    const [savedRooms, setSavedRooms] = useState<Room[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const fetchCompetition = useCallback(async () => {
        const response = await getCompetitionInfo();
        setCompetition(response.data);
    }, [setCompetition]);

    useEffect(() => {
        if (!competition) fetchCompetition();
    }, [competition, fetchCompetition]);

    useEffect(() => {
        getAllRooms().then((data: Room[]) => {
            setSavedRooms(data);
            setRooms(data);
        });
    }, []);

    const groupOptions = useMemo(
        () => (competition ? getGroupOptions(competition.wcif) : []),
        [competition]
    );

    const isDirty = JSON.stringify(rooms) !== JSON.stringify(savedRooms);
    const changes = describeGroupChanges(savedRooms, rooms);
    const roundsToOpen = getRoundsToOpen(rooms, isUnofficialEvent);

    const setRoomGroups = (roomId: string, groupIds: string[]) => {
        const error = getRoomGroupsError(groupIds);
        if (error) {
            toast({ title: error, variant: "destructive" });
            return;
        }
        setRooms((prev) =>
            prev.map((room) =>
                room.id === roomId
                    ? { ...room, currentGroupIds: groupIds }
                    : room
            )
        );
    };

    const handleNext = async (room: Room) =>
        setRoomGroups(room.id, await getNextGroupsFromScheduleForRoom(room.id));

    const handlePrevious = async (room: Room) =>
        setRoomGroups(
            room.id,
            await getPreviousGroupsFromScheduleForRoom(room.id)
        );

    const handleSave = async () => {
        setIsSaving(true);
        const response = await updateCurrentRound(rooms);
        setIsSaving(false);
        if (response.status === 200) {
            setSavedRooms(rooms);
            toast({ title: "Groups saved", variant: "success" });
        } else if (response.status === 400) {
            toast({ title: response.data.message, variant: "destructive" });
        } else {
            toast({ title: "Something went wrong!", variant: "destructive" });
        }
    };

    if (!competition) return <LoadingPage />;

    return (
        <>
            <SetupTabs value="groups" />
            {roundsToOpen.length > 0 && (
                <Alert>
                    <Info />
                    <p className="text-pretty">
                        Remember to open the following rounds in WCA Live:{" "}
                        {roundsToOpen.map((roundId, index) => (
                            <span key={roundId}>
                                <b className="font-semibold">
                                    {activityCodeToName(roundId).replace(
                                        ", ",
                                        " · "
                                    )}
                                </b>
                                {index < roundsToOpen.length - 1 && ", "}
                            </span>
                        ))}
                    </p>
                </Alert>
            )}
            {rooms.map((room) => {
                const saved = savedRooms.find((r) => r.id === room.id);
                const hasGroups = room.currentGroupIds.length > 0;
                return (
                    <section
                        key={room.id}
                        aria-label={room.name}
                        className="flex flex-col gap-3 rounded-mobile-card border bg-card p-3.5 md:gap-3.5 md:rounded-2xl md:px-5 md:py-[18px]"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-baseline gap-2.5">
                                <h2 className="text-base font-bold">
                                    {room.name}
                                </h2>
                                <span className="text-[13px] text-muted-foreground">
                                    {groupCountLabel(
                                        room.currentGroupIds.length
                                    )}
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePrevious(room)}
                                >
                                    <SkipBack />
                                    Previous from schedule
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleNext(room)}
                                >
                                    <SkipForward />
                                    Next from schedule
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-destructive"
                                    disabled={!hasGroups}
                                    onClick={() => setRoomGroups(room.id, [])}
                                >
                                    <ListX />
                                    Clear
                                </Button>
                            </div>
                        </div>
                        {hasGroups ? (
                            <ul className="flex flex-col gap-1.5 md:flex-row md:flex-wrap md:gap-2">
                                {room.currentGroupIds.map((groupId) => (
                                    <li
                                        key={groupId}
                                        className="flex h-12 items-center gap-2.5 rounded-chip border border-primary bg-primary-soft pl-3 pr-0.5 text-primary md:h-9 md:gap-2 md:rounded-lg md:pr-1"
                                    >
                                        <span
                                            aria-hidden
                                            className={cn(
                                                "cubing-icon text-lg md:text-base",
                                                getEventIconClass(
                                                    groupId.split("-r")[0]
                                                )
                                            )}
                                        />
                                        <span className="flex-1 whitespace-nowrap text-[15px] font-semibold md:text-sm">
                                            {getGroupLabel(groupId)}
                                        </span>
                                        {!saved?.currentGroupIds.includes(
                                            groupId
                                        ) && (
                                            <span
                                                title="Not saved yet"
                                                className="size-[7px] rounded-full bg-warning md:size-1.5"
                                            />
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            className="text-primary hover:bg-card hover:text-primary md:size-7"
                                            aria-label={`Remove ${getGroupLabel(groupId)}`}
                                            onClick={() =>
                                                setRoomGroups(
                                                    room.id,
                                                    room.currentGroupIds.filter(
                                                        (id) => id !== groupId
                                                    )
                                                )
                                            }
                                        >
                                            <X />
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <EmptyState className="min-h-0 rounded-chip p-3.5 md:rounded-chip">
                                No groups in progress
                            </EmptyState>
                        )}
                        <div className="flex max-w-[360px] flex-col gap-1.5">
                            <Label className="text-[13px] font-semibold text-muted-foreground max-md:sr-only">
                                Add group
                            </Label>
                            <Select
                                value=""
                                onValueChange={(groupId) =>
                                    setRoomGroups(room.id, [
                                        ...room.currentGroupIds,
                                        groupId,
                                    ])
                                }
                            >
                                <SelectTrigger aria-label="Add group">
                                    <SelectValue placeholder="Select group…" />
                                </SelectTrigger>
                                <SelectContent>
                                    {groupOptions
                                        .filter(
                                            (option) =>
                                                !room.currentGroupIds.includes(
                                                    option.id
                                                )
                                        )
                                        .map((option) => (
                                            <SelectItem
                                                key={option.id}
                                                value={option.id}
                                                disabled={
                                                    !canAddGroup(
                                                        room.currentGroupIds,
                                                        option.id
                                                    )
                                                }
                                            >
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </section>
                );
            })}
            {changes.length > 0 && (
                <section
                    aria-label="Changes to save"
                    className="flex flex-col gap-1.5 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3"
                >
                    <p className="text-[13px] font-semibold text-warning">
                        Saving will change:
                    </p>
                    <ul className="flex flex-col gap-0.5 text-sm">
                        {changes.map((change) => (
                            <li key={change}>{change}</li>
                        ))}
                    </ul>
                </section>
            )}
            <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
                <Button
                    onClick={handleSave}
                    disabled={!isDirty || isSaving}
                    className="md:w-fit"
                >
                    <Save />
                    Save
                </Button>
                {isDirty && (
                    <div className="flex items-center justify-between gap-2.5 md:contents">
                        <span className="text-[13px] text-warning md:order-last">
                            Unsaved changes
                        </span>
                        <Button
                            variant="ghost"
                            onClick={() => setRooms(savedRooms)}
                        >
                            Discard changes
                        </Button>
                    </div>
                )}
            </div>
        </>
    );
};

export default CurrentGroups;
