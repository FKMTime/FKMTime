import { useCallback, useMemo, useState } from "react";

import EmptyState from "@/Components/shared/EmptyState";
import LiveStationCard from "@/Components/shared/LiveStationCard";
import SegmentedControl from "@/Components/shared/SegmentedControl";
import { StatusTone } from "@/Components/shared/status";
import { StatusDot } from "@/Components/shared/StatusBadge";
import { useIsMobile } from "@/hooks/useMobile";
import { activityCodeToName } from "@/lib/activities";
import {
    groupStationsByRoom,
    OTHER_STATIONS_ID,
    StationInfo,
    StationPhase,
    StationRoom,
} from "@/lib/liveSolving";

const ALL_ROOMS = "all";

const COUNTED_PHASES: {
    phase: StationPhase;
    label: string;
    tone: StatusTone;
}[] = [
    { phase: "solving", label: "solving", tone: "success" },
    { phase: "inspection", label: "in inspection", tone: "warning" },
    { phase: "offline", label: "offline", tone: "neutral" },
];

const formatRounds = (roundIds: string[]) =>
    roundIds.length
        ? roundIds
              .map((roundId) =>
                  activityCodeToName(roundId).replace(", ", " · ")
              )
              .join(", ")
        : "No round in progress";

interface LiveSolvingBoardProps {
    stations: StationInfo[];
    rooms: StationRoom[];
    /** Staff only: device names with an incident not yet cleared */
    incidentDevices?: Set<string>;
    /** Staff only: count offline stations beside solving and inspection */
    showOfflineCount?: boolean;
    allRoomsLabel?: string;
}

/**
 * Station cards grouped by room, with a room filter when stations span
 * several rooms and solving / inspection counts for the shown stations.
 * Shared by the staff live solving page and the public display.
 */
const LiveSolvingBoard = ({
    stations,
    rooms,
    incidentDevices,
    showOfflineCount = false,
    allRoomsLabel = "All",
}: LiveSolvingBoardProps) => {
    const [phases, setPhases] = useState<Map<number, StationPhase>>(new Map());
    const [roomFilter, setRoomFilter] = useState(ALL_ROOMS);
    const isMobile = useIsMobile();

    const handlePhaseChange = useCallback(
        (espId: number, phase: StationPhase) =>
            setPhases((prev) => {
                if (prev.get(espId) === phase) return prev;
                return new Map(prev).set(espId, phase);
            }),
        []
    );

    const groups = useMemo(
        () => groupStationsByRoom(stations, rooms),
        [stations, rooms]
    );
    const shownGroups =
        roomFilter === ALL_ROOMS
            ? groups
            : groups.filter((group) => group.id === roomFilter);

    // Hidden rooms' cards are unmounted, so only shown stations are current
    const shownPhases = shownGroups.flatMap((group) =>
        group.stations.map((station) => phases.get(station.espId))
    );
    const countPhase = (phase: StationPhase) =>
        shownPhases.filter((current) => current === phase).length;
    const countedPhases = COUNTED_PHASES.filter(
        ({ phase }) => showOfflineCount || phase !== "offline"
    );

    if (groups.length === 0)
        return (
            <EmptyState>
                No active stations. Times will appear here once devices start
                sending data.
            </EmptyState>
        );

    return (
        <div className="flex flex-col gap-[18px] md:gap-6">
            <div className="flex flex-col gap-3.5 md:flex-row md:flex-wrap md:items-center md:gap-4">
                {groups.length > 1 && (
                    <SegmentedControl
                        label="Room"
                        value={roomFilter}
                        onValueChange={setRoomFilter}
                        options={[
                            { value: ALL_ROOMS, label: allRoomsLabel },
                            ...groups.map((group) => ({
                                value: group.id,
                                label: group.name,
                            })),
                        ]}
                        fullWidth={isMobile}
                    />
                )}
                <div className="flex flex-wrap items-center gap-3.5 text-[13px] text-muted-foreground md:ml-auto md:gap-4">
                    {countedPhases.map(({ phase, label, tone }) => (
                        <span key={phase} className="flex items-center gap-1.5">
                            <StatusDot tone={tone} className="size-2" />
                            <b className="font-bold text-foreground">
                                {countPhase(phase)}
                            </b>
                            {label}
                        </span>
                    ))}
                </div>
            </div>
            {shownGroups.map((group) => (
                <section
                    key={group.id}
                    aria-label={group.name}
                    className="flex flex-col gap-2 md:gap-3"
                >
                    <div className="flex items-baseline gap-2 pl-0.5 md:gap-2.5 md:pl-0">
                        <h2 className="text-[15px] font-bold md:text-base">
                            {group.name}
                        </h2>
                        {group.id !== OTHER_STATIONS_ID && (
                            <span className="text-[13px] text-muted-foreground">
                                {formatRounds(group.roundIds)}
                            </span>
                        )}
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] md:gap-3">
                        {group.stations.map((station) => (
                            <LiveStationCard
                                key={station.espId}
                                station={station}
                                showRound={group.roundIds.length > 1}
                                hasIncident={
                                    incidentDevices?.has(station.deviceName) ??
                                    false
                                }
                                onPhaseChange={handlePhaseChange}
                            />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
};

export default LiveSolvingBoard;
