import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo, useState } from "react";

import LoadingPage from "@/Components/LoadingPage";
import EmptyState from "@/Components/shared/EmptyState";
import SegmentedControl from "@/Components/shared/SegmentedControl";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import { competitionAtom, quickEntryAtom } from "@/lib/atoms";
import { getRecentAttemptsByRoundId } from "@/lib/attempt";
import { getNextGroupsFromScheduleForRoom } from "@/lib/competition";
import { getUnresolvedIncidents } from "@/lib/incidents";
import { Incident, Room } from "@/lib/interfaces";
import {
    isDelegate,
    isOrganizerOrDelegate,
    isStageLeaderOrOrganizerOrDelegate,
} from "@/lib/permissions";
import {
    getAllRooms,
    getRoomsProgress,
    RoomProgress,
    updateCurrentRound,
} from "@/lib/rooms";
import { getStartLabel } from "@/lib/schedule";
import { socket } from "@/socket";

import NextGroupInAllRooms from "./Components/NextGroupInAllRooms";
import RoomCard, { RecentAttempt } from "./Components/RoomCard";

/** Re-render this often so the schedule offset stays current */
const CLOCK_TICK_MS = 30_000;

const Home = () => {
    const competition = useAtomValue(competitionAtom);
    const setQuickEntry = useSetAtom(quickEntryAtom);
    const confirm = useConfirm();
    const { toast } = useToast();

    const [rooms, setRooms] = useState<Room[] | null>(null);
    const [progress, setProgress] = useState<RoomProgress[]>([]);
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [recentAttempts, setRecentAttempts] = useState<
        Record<string, RecentAttempt[]>
    >({});
    const [nextGroups, setNextGroups] = useState<Record<string, string[]>>({});
    const [selectedRoomId, setSelectedRoomId] = useState<string>();
    const [now, setNow] = useState(() => new Date());

    const canStartGroups = isOrganizerOrDelegate();
    const canResolveIncidents = isDelegate();

    const currentRoundIds = useMemo(
        () => [
            ...new Set(
                (rooms ?? []).flatMap((room) =>
                    room.currentGroupIds.map((id) => id.split("-g")[0])
                )
            ),
        ],
        [rooms]
    );

    const fetchResults = useCallback(async (roundIds: string[]) => {
        const [progressData, ...recent] = await Promise.all([
            getRoomsProgress(),
            ...roundIds.map(getRecentAttemptsByRoundId),
        ]);
        setProgress(progressData);
        setRecentAttempts(
            Object.fromEntries(
                roundIds.map((roundId, index) => [roundId, recent[index]])
            )
        );
    }, []);

    const fetchIncidents = useCallback(async () => {
        if (!canResolveIncidents) return;
        setIncidents(await getUnresolvedIncidents());
    }, [canResolveIncidents]);

    const fetchRooms = useCallback(async () => {
        const data: Room[] = await getAllRooms();
        setRooms(data);
        if (canStartGroups) {
            const next = await Promise.all(
                data.map((room) => getNextGroupsFromScheduleForRoom(room.id))
            );
            setNextGroups(
                Object.fromEntries(data.map((room, i) => [room.id, next[i]]))
            );
        }
    }, [canStartGroups]);

    useEffect(() => {
        fetchRooms();
        fetchIncidents();
    }, [fetchRooms, fetchIncidents]);

    useEffect(() => {
        fetchResults(currentRoundIds);
        const onResultEntered = () => fetchResults(currentRoundIds);
        currentRoundIds.forEach((roundId) =>
            socket.emit("joinResults", { roundId })
        );
        socket.on("resultEntered", onResultEntered);
        return () => {
            socket.off("resultEntered", onResultEntered);
            currentRoundIds.forEach((roundId) =>
                socket.emit("leaveResults", { roundId })
            );
        };
    }, [currentRoundIds, fetchResults]);

    useEffect(() => {
        // The layout keeps the incidents room joined; only listen here
        socket.on("newIncident", fetchIncidents);
        socket.on("attemptUpdated", fetchIncidents);
        return () => {
            socket.off("newIncident", fetchIncidents);
            socket.off("attemptUpdated", fetchIncidents);
        };
    }, [fetchIncidents]);

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
        return () => clearInterval(interval);
    }, []);

    if (!competition || !rooms) return <LoadingPage />;

    const incidentsByRoom = (roomId: string) =>
        incidents.filter((incident) => incident.device?.roomId === roomId);

    const handleStartNext = async (room: Room, nextGroupIds: string[]) => {
        const label = getStartLabel(room.currentGroupIds, nextGroupIds);
        try {
            await confirm({
                title: `${label} in ${room.name}?`,
                description:
                    "Devices in this room will switch to the new group.",
                confirmLabel: label ?? "Start",
                variant: "default",
            });
        } catch {
            return;
        }
        const response = await updateCurrentRound(
            rooms.map((r) =>
                r.id === room.id ? { ...r, currentGroupIds: nextGroupIds } : r
            )
        );
        if (response.status === 200) {
            toast({ title: `${room.name}: group started`, variant: "success" });
            fetchRooms();
        } else {
            toast({
                title: "Failed to start the group",
                description: response.data?.message,
                variant: "destructive",
            });
        }
    };

    const handleSwitchAll = async (updated: Room[]) => {
        const response = await updateCurrentRound(updated);
        if (response.status !== 200)
            return response.data?.message ?? "Failed to start the next groups";
        toast({ title: "Next group started in all rooms", variant: "success" });
        fetchRooms();
        return null;
    };

    const selectedRoom =
        rooms.find((room) => room.id === selectedRoomId) ?? rooms[0];

    const renderRoom = (room: Room) => (
        <RoomCard
            key={room.id}
            room={room}
            wcif={competition.wcif}
            progress={progress.find((p) => p.roomId === room.id)?.groups ?? []}
            incidents={incidentsByRoom(room.id)}
            recentAttempts={recentAttempts}
            nextGroupIds={canStartGroups ? nextGroups[room.id] : undefined}
            now={now}
            isRoomNamedElsewhere={rooms.length > 1}
            canEnterAttempts={isDelegate() && competition.useFkmTimeDevices}
            canOpenAttendance={isStageLeaderOrOrganizerOrDelegate()}
            canResolveIncidents={canResolveIncidents}
            onStartNext={handleStartNext}
            onEnterAttempt={(roundId) =>
                setQuickEntry({ isOpen: true, roundId })
            }
        />
    );

    if (rooms.length === 0)
        return <EmptyState>This competition has no rooms.</EmptyState>;

    return (
        <>
            {canStartGroups && (
                <NextGroupInAllRooms
                    rooms={rooms}
                    nextGroups={nextGroups}
                    onSwitch={handleSwitchAll}
                />
            )}
            {rooms.length > 1 && (
                <SegmentedControl
                    label="Room"
                    fullWidth
                    className="md:hidden"
                    value={selectedRoom.id}
                    onValueChange={setSelectedRoomId}
                    options={rooms.map((room) => ({
                        value: room.id,
                        label: room.name,
                        badge: canResolveIncidents
                            ? incidentsByRoom(room.id).length
                            : undefined,
                    }))}
                />
            )}
            <div className="md:hidden">{renderRoom(selectedRoom)}</div>
            <div className="hidden grid-cols-1 items-start gap-6 md:grid lg:grid-cols-2 2xl:grid-cols-3">
                {rooms.map(renderRoom)}
            </div>
        </>
    );
};

export default Home;
