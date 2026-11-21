import { useQueries } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useMemo, useState } from "react";

import LoadingPage from "@/Components/LoadingPage";
import EmptyState from "@/Components/shared/EmptyState";
import SegmentedControl from "@/Components/shared/SegmentedControl";
import { useAttendanceScope } from "@/hooks/useAttendanceScope";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useSocketEvents } from "@/hooks/useSocketEvents";
import { useSocketRoom } from "@/hooks/useSocketRoom";
import { useStationTutorial } from "@/hooks/useStationTutorial";
import { useToast } from "@/hooks/useToast";
import { competitionAtom, quickEntryAtom } from "@/lib/atoms";
import { recentAttemptsQuery } from "@/lib/attempt";
import { competitionSettingsQuery, nextGroupsQuery } from "@/lib/competition";
import { getStartedRounds } from "@/lib/currentGroups";
import { uncoveredGroupsQuery } from "@/lib/delegateGrants";
import {
    getPointedStations,
    setStationsRound,
    stationDevicesQuery,
} from "@/lib/devices";
import { isUnofficialEvent } from "@/lib/events";
import { unresolvedIncidentsQuery } from "@/lib/incidents";
import { Device, Room } from "@/lib/interfaces";
import {
    isDelegate,
    isOrganizerOrDelegate,
    isStageLeaderOrOrganizerOrDelegate,
} from "@/lib/permissions";
import { toQueryOptions } from "@/lib/queryCache";
import { queryClient } from "@/lib/queryClient";
import {
    isGroupDone,
    roomsProgressQuery,
    roomsQuery,
    updateCurrentRound,
    updateRoomGroups,
} from "@/lib/rooms";
import { getStartLabel, sortRoomsBySchedule } from "@/lib/schedule";
import { useNoShow } from "@/Pages/Main/Attendance/useNoShow";
import { invalidateIncidentLists } from "@/Pages/Main/Incidents/incidentsContext";

import IntegratedLiveConnectionAlert from "./Components/IntegratedLiveConnectionAlert";
import IntegratedLiveProblemsAlert from "./Components/IntegratedLiveProblemsAlert";
import IntegratedLiveRoundsToOpen from "./Components/IntegratedLiveRoundsToOpen";
import NextGroupInAllRooms from "./Components/NextGroupInAllRooms";
import NoFreeDelegateAlert from "./Components/NoFreeDelegateAlert";
import NoShowsToRemove from "./Components/NoShowsToRemove";
import RoomCard from "./Components/RoomCard";
import RoundsToOpenDialog from "./Components/RoundsToOpenDialog";
import TutorialStationsAlert from "./Components/TutorialStationsAlert";
import TutorialSuggestion from "./Components/TutorialSuggestion";
import { useAskToChangeGroups } from "./Components/useAskToChangeGroups";

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
            path === uncoveredGroupsQuery.key ||
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
    const askToChangeGroups = useAskToChangeGroups();
    const { toast } = useToast();
    const [startedRounds, setStartedRounds] = useState<string[]>([]);

    const { data: unorderedRooms } = useLiveQuery(roomsQuery);
    // In the schedule's order, so rooms keep their places as they change
    const rooms = useMemo(
        () =>
            competition && unorderedRooms
                ? sortRoomsBySchedule(unorderedRooms, competition.wcif)
                : unorderedRooms,
        [competition, unorderedRooms]
    );
    const { data: progressData } = useLiveQuery(roomsProgressQuery);
    const progress = progressData ?? [];
    const [selectedRoomId, setSelectedRoomId] = useState<string>();
    const [now, setNow] = useState(() => new Date());

    const canStartGroups = isOrganizerOrDelegate();
    const canOpenAttendance = isStageLeaderOrOrganizerOrDelegate();
    // A stage lead takes attendance in their rooms only (SPEC-016)
    const attendanceScope = useAttendanceScope();
    const canOpenRoomAttendance = (roomId: string) =>
        canOpenAttendance && attendanceScope.hasRoom(roomId);
    // A competitor not coming no longer holds their group back
    const setNoShow = useNoShow(refreshResults);
    const canResolveIncidents = isDelegate();

    // Groups every delegate competes in (SPEC-015); refreshed when grants
    // change and when the rooms do
    const { data: uncoveredGroups } = useLiveQuery(uncoveredGroupsQuery, {
        enabled: canResolveIncidents,
    });

    // Whether rooms move on by themselves; it's changed in the settings.
    // The panel's competition doesn't carry it; the settings do
    const { data: settings } = useLiveQuery(competitionSettingsQuery, {
        enabled: canStartGroups,
    });

    // Stations pointed at another round stay listed on their room's card
    // until a delegate sends them back (SPEC-007)
    const { data: stations } = useLiveQuery(stationDevicesQuery, {
        enabled: canStartGroups,
    });
    const pointedStations = getPointedStations(stations ?? []);
    const refreshStations = () =>
        void queryClient.invalidateQueries({
            queryKey: [stationDevicesQuery.key],
        });
    const { startTutorial, endTutorial } = useStationTutorial(refreshStations);
    useSocketRoom(canStartGroups ? "Devices" : null, {
        invalidateOn: { deviceUpdated: [stationDevicesQuery.key] },
    });

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
        // Sent when the backend changes a room's groups by itself
        groupShouldBeChanged: refreshRooms,
    });

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
        return () => clearInterval(interval);
    }, []);

    if (!competition || !rooms) return <LoadingPage />;

    const incidentsByRoom = (roomId: string) =>
        incidents.filter((incident) => incident.device?.roomId === roomId);

    const getProgress = (roomId: string, groupId: string) =>
        progress
            .find((p) => p.roomId === roomId)
            ?.groups.find((g) => g.groupId === groupId);

    /** Asks to open in WCA Live the official rounds a change started */
    const noteStartedRounds = (updated: Room[]) =>
        setStartedRounds(
            getStartedRounds(
                rooms,
                rooms.map(
                    (room) => updated.find((u) => u.id === room.id) ?? room
                ),
                isUnofficialEvent
            )
        );

    // Saves only this room: the others may have moved on since Home loaded
    const setRoomGroups = async (room: Room, groupIds: string[]) => {
        const response = await updateRoomGroups(room, groupIds);
        if (response.status !== 200) {
            toast({
                title: `${room.name} wasn't updated`,
                description: response.data?.message,
                variant: "destructive",
            });
            return false;
        }
        noteStartedRounds([{ ...room, currentGroupIds: groupIds }]);
        toast({ title: `${room.name} updated`, variant: "success" });
        refreshRooms();
        return true;
    };

    const handleStartNext = async (room: Room, nextGroupIds: string[]) => {
        const label =
            getStartLabel(room.currentGroupIds, nextGroupIds) ?? "Start";
        const title = `${label} in ${room.name}?`;
        if (
            await askToChangeGroups({
                title,
                confirmLabel: label,
                change: "start",
            })
        )
            await setRoomGroups(room, nextGroupIds);
    };

    const handleSwitchAll = async (updated: Room[]) => {
        const response = await updateCurrentRound(updated);
        if (response.status !== 200)
            return response.data?.message ?? "Failed to start the next groups";
        noteStartedRounds(updated);
        toast({
            title:
                updated.length === rooms.length
                    ? "Next group started in all rooms"
                    : `Next group started in ${updated.length} rooms`,
            variant: "success",
        });
        refreshRooms();
        return null;
    };

    const handleBackToRoom = async (station: Device) => {
        const status = await setStationsRound([station.id], null);
        if (status === 200) {
            toast({
                title: `${station.name} is back on its room's round`,
                variant: "success",
            });
            void queryClient.invalidateQueries({
                queryKey: [stationDevicesQuery.key],
            });
        } else {
            toast({
                title: "Failed to send the station back",
                variant: "destructive",
            });
        }
    };

    const isAutoChange = !!settings?.shouldChangeGroupsAutomatically;

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
            canOpenAttendance={canOpenRoomAttendance(room.id)}
            canResolveIncidents={canResolveIncidents}
            onStartNext={handleStartNext}
            onEnterAttempt={(roundId) =>
                setQuickEntry({ isOpen: true, roundId })
            }
            pointedStations={pointedStations.filter(
                (station) => station.roomId === room.id
            )}
            onBackToRoom={isDelegate() ? handleBackToRoom : undefined}
            onMarkNotComing={
                canOpenRoomAttendance(room.id)
                    ? (person, groupId) =>
                          setNoShow(person, [groupId], true, true)
                    : undefined
            }
            groupControls={
                canStartGroups
                    ? {
                          rooms,
                          getProgress,
                          isAutoChange,
                          onSetGroups: setRoomGroups,
                      }
                    : undefined
            }
        />
    );

    if (rooms.length === 0)
        return <EmptyState>This competition has no rooms.</EmptyState>;

    return (
        <>
            {competition && isOrganizerOrDelegate() && (
                <>
                    <IntegratedLiveConnectionAlert competition={competition} />
                    <IntegratedLiveProblemsAlert />
                </>
            )}
            {canStartGroups &&
                competition?.officialResultsDestination ===
                    "WCA_INTEGRATED_LIVE" &&
                competition.integratedLiveConnection === "CONNECTED" && (
                    <>
                        <IntegratedLiveRoundsToOpen
                            roundIds={currentRoundIds}
                        />
                        <NoShowsToRemove />
                    </>
                )}
            {canResolveIncidents && uncoveredGroups && (
                <NoFreeDelegateAlert
                    groups={uncoveredGroups}
                    showRooms={rooms.length > 1}
                />
            )}
            {canStartGroups && stations && (
                <>
                    <TutorialStationsAlert
                        stations={stations}
                        onEnd={isDelegate() ? endTutorial : undefined}
                    />
                    <TutorialSuggestion
                        wcif={competition.wcif}
                        rooms={rooms}
                        stations={stations}
                        onStart={isDelegate() ? startTutorial : undefined}
                    />
                </>
            )}
            {currentRoundIds.map((roundId) => (
                <ResultsRoom key={roundId} roundId={roundId} />
            ))}
            {canStartGroups && (
                <>
                    <RoundsToOpenDialog
                        roundIds={startedRounds}
                        onClose={() => setStartedRounds([])}
                    />
                    <NextGroupInAllRooms
                        rooms={rooms}
                        nextGroups={nextGroups}
                        isReady={(room) =>
                            room.currentGroupIds.every((id) =>
                                isGroupDone(getProgress(room.id, id))
                            )
                        }
                        onSwitch={handleSwitchAll}
                    />
                </>
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
