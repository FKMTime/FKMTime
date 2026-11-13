import { useQueries } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useMemo, useState } from "react";

import LoadingPage from "@/Components/LoadingPage";
import EmptyState from "@/Components/shared/EmptyState";
import SegmentedControl from "@/Components/shared/SegmentedControl";
import { useConfirm } from "@/hooks/useConfirm";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useSocketEvents } from "@/hooks/useSocketEvents";
import { useSocketRoom } from "@/hooks/useSocketRoom";
import { useToast } from "@/hooks/useToast";
import { competitionAtom, quickEntryAtom } from "@/lib/atoms";
import { recentAttemptsQuery } from "@/lib/attempt";
import { nextGroupsQuery } from "@/lib/competition";
import { unresolvedIncidentsQuery } from "@/lib/incidents";
import { Room } from "@/lib/interfaces";
import {
    isDelegate,
    isOrganizerOrDelegate,
    isStageLeaderOrOrganizerOrDelegate,
} from "@/lib/permissions";
import { toQueryOptions } from "@/lib/queryCache";
import { queryClient } from "@/lib/queryClient";
import {
    roomsProgressQuery,
    roomsQuery,
    updateCurrentRound,
} from "@/lib/rooms";
import { getStartLabel } from "@/lib/schedule";
import { invalidateIncidentLists } from "@/Pages/Main/Incidents/incidentsContext";

import IntegratedLiveConnectionAlert from "./Components/IntegratedLiveConnectionAlert";
import IntegratedLiveRoundsToOpen from "./Components/IntegratedLiveRoundsToOpen";
import NextGroupInAllRooms from "./Components/NextGroupInAllRooms";
import RoomCard from "./Components/RoomCard";

/** Re-render this often so the schedule offset stays current */
const CLOCK_TICK_MS = 30_000;

/** Refetches every query whose path matches */
const invalidatePaths = (matches: (path: string) => boolean) =>
    void queryClient.invalidateQueries({
        predicate: ({ queryKey: [path] }) =>
            typeof path === "string" && matches(path),
    });

const refreshResults = () =>
    invalidatePaths(
        (path) =>
            path === roomsProgressQuery.key ||
            (path.startsWith("attempt/round/") && path.endsWith("/recent"))
    );

const refreshRooms = () =>
    invalidatePaths(
        (path) =>
            path === roomsQuery.key ||
            path === roomsProgressQuery.key ||
            (path.startsWith("competition/rooms/") &&
                path.endsWith("/next-groups"))
    );

/** Keeps a round's results room joined while its group runs */
const ResultsRoom = ({ roundId }: { roundId: string }) => {
    useSocketRoom("Results", { params: { roundId } });
    return null;
};

const Home = () => {
    const competition = useAtomValue(competitionAtom);
    const setQuickEntry = useSetAtom(quickEntryAtom);
    const confirm = useConfirm();
    const { toast } = useToast();

    const { data: rooms } = useLiveQuery(roomsQuery);
    const { data: progressData } = useLiveQuery(roomsProgressQuery);
    const progress = progressData ?? [];
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

    const { data: incidentsData } = useLiveQuery(unresolvedIncidentsQuery, {
        enabled: canResolveIncidents,
    });
    const incidents = incidentsData ?? [];

    // Keyed by round and by room, only once each has loaded
    const recentAttempts = useQueries({
        queries: currentRoundIds.map((roundId) =>
            toQueryOptions(recentAttemptsQuery(roundId))
        ),
        combine: (results) =>
            Object.fromEntries(
                currentRoundIds.flatMap((roundId, index) =>
                    results[index].data ? [[roundId, results[index].data]] : []
                )
            ),
    });
    const nextGroups = useQueries({
        queries: (canStartGroups ? rooms ?? [] : []).map((room) =>
            toQueryOptions(nextGroupsQuery(room.id))
        ),
        combine: (results): Record<string, string[]> =>
            Object.fromEntries(
                (rooms ?? []).flatMap((room, index) =>
                    results[index]?.data ? [[room.id, results[index].data]] : []
                )
            ),
    });

    // The layout keeps the incidents room joined; ResultsRoom joins each
    // running round's results room
    useSocketEvents({
        resultEntered: refreshResults,
        newIncident: () => void invalidateIncidentLists(),
        attemptUpdated: () => void invalidateIncidentLists(),
    });

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
            refreshRooms();
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
        refreshRooms();
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
            {competition && isOrganizerOrDelegate() && (
                <IntegratedLiveConnectionAlert competition={competition} />
            )}
            {canStartGroups &&
                competition?.officialResultsDestination ===
                    "WCA_INTEGRATED_LIVE" &&
                competition.integratedLiveConnection === "CONNECTED" && (
                    <IntegratedLiveRoundsToOpen roundIds={currentRoundIds} />
                )}
            {currentRoundIds.map((roundId) => (
                <ResultsRoom key={roundId} roundId={roundId} />
            ))}
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
