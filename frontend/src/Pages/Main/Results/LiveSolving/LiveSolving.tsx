import { useCallback, useContext, useEffect, useMemo, useState } from "react";

import EmptyState from "@/Components/shared/EmptyState";
import LiveStationCard from "@/Components/shared/LiveStationCard";
import SegmentedControl from "@/Components/shared/SegmentedControl";
import { StatusTone } from "@/Components/shared/status";
import { StatusDot } from "@/Components/shared/StatusBadge";
import { useIsMobile } from "@/hooks/useMobile";
import { activityCodeToName } from "@/lib/activities";
import { getAllDevices } from "@/lib/devices";
import { Device, DeviceType, Room } from "@/lib/interfaces";
import {
    groupStationsByRoom,
    OTHER_STATIONS_ID,
    StationInfo,
    StationPhase,
} from "@/lib/liveSolving";
import { getAllRooms } from "@/lib/rooms";
import { socket, SocketContext } from "@/socket";

interface NewIncidentData {
    id: string;
    deviceName: string;
    competitorName: string;
}

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

const playIncidentAlert = () => {
    const ctx = new AudioContext();

    const beep = (start: number, freq: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "square";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.18, start + 0.01);
        gain.gain.setValueAtTime(0.18, start + dur - 0.03);
        gain.gain.linearRampToValueAtTime(0, start + dur);
        osc.start(start);
        osc.stop(start + dur);
    };

    const t = ctx.currentTime;
    beep(t, 880, 0.12);
    beep(t + 0.16, 660, 0.12);
    beep(t + 0.32, 880, 0.12);
    beep(t + 0.48, 660, 0.18);
};

const idleStation = (device: Device): StationInfo => ({
    espId: device.espId,
    deviceName: device.name,
    personName: null,
    registrantId: null,
    groupId: null,
    time: null,
    inspection: null,
    cumulativeLimitCentiseconds: null,
    cumulativeRemainingCentiseconds: null,
    // Never heard from, so it shows as offline until its first packet
    serverReceivedAt: 0,
});

const LiveSolving = () => {
    const [stations, setStations] = useState<Map<number, StationInfo>>(
        new Map()
    );
    const [incidentDevices, setIncidentDevices] = useState<Set<string>>(
        new Set()
    );

    const [rooms, setRooms] = useState<Room[]>([]);
    const [roomIdByEspId, setRoomIdByEspId] = useState<Map<number, string>>(
        new Map()
    );
    const [phases, setPhases] = useState<Map<number, StationPhase>>(new Map());
    const [roomFilter, setRoomFilter] = useState(ALL_ROOMS);
    const isMobile = useIsMobile();

    const [isConnected] = useContext(SocketContext) as [
        number,
        React.Dispatch<React.SetStateAction<number>>,
    ];

    useEffect(() => {
        getAllRooms().then(setRooms);
        getAllDevices(DeviceType.STATION).then((devices: Device[]) => {
            setRoomIdByEspId(
                new Map(devices.map((device) => [device.espId, device.roomId]))
            );
            setStations((prev) => {
                const next = new Map(prev);
                for (const device of devices) {
                    if (!next.has(device.espId)) {
                        next.set(device.espId, idleStation(device));
                    }
                }
                return next;
            });
        });
    }, [isConnected]);

    const handleCurrentStations = useCallback((data: StationInfo[]) => {
        setStations((prev) => {
            const next = new Map(prev);
            data.forEach((s) => next.set(s.espId, s));
            return next;
        });
    }, []);

    const handleCurrentTimeInfo = useCallback((data: StationInfo) => {
        setIncidentDevices((prev) => {
            if (!prev.has(data.deviceName)) return prev;
            const next = new Set(prev);
            next.delete(data.deviceName);
            return next;
        });
        setStations((prev) => {
            const next = new Map(prev);
            next.set(data.espId, data);
            return next;
        });
    }, []);

    const handleNewIncident = useCallback((data: NewIncidentData) => {
        playIncidentAlert();
        setIncidentDevices((prev) => new Set([...prev, data.deviceName]));
        setStations((prev) => {
            const entry = [...prev.values()].find(
                (s) => s.deviceName === data.deviceName
            );
            if (!entry) return prev;
            const next = new Map(prev);
            next.set(entry.espId, {
                ...entry,
                personName: data.competitorName,
            });
            return next;
        });
    }, []);

    useEffect(() => {
        socket.emit("joinLiveSolving");
        socket.on("currentStations", handleCurrentStations);
        socket.on("currentTimeInfo", handleCurrentTimeInfo);
        socket.on("newIncident", handleNewIncident);

        return () => {
            socket.emit("leaveLiveSolving");
            socket.off("currentStations", handleCurrentStations);
            socket.off("currentTimeInfo", handleCurrentTimeInfo);
            socket.off("newIncident", handleNewIncident);
        };
    }, [
        handleCurrentStations,
        handleCurrentTimeInfo,
        handleNewIncident,
        isConnected,
    ]);

    const handlePhaseChange = useCallback(
        (espId: number, phase: StationPhase) =>
            setPhases((prev) => {
                if (prev.get(espId) === phase) return prev;
                return new Map(prev).set(espId, phase);
            }),
        []
    );

    const groups = useMemo(
        () =>
            groupStationsByRoom(
                Array.from(stations.values()),
                roomIdByEspId,
                rooms
            ),
        [stations, roomIdByEspId, rooms]
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
                            { value: ALL_ROOMS, label: "All" },
                            ...groups.map((group) => ({
                                value: group.id,
                                label: group.name,
                            })),
                        ]}
                        fullWidth={isMobile}
                    />
                )}
                <div className="flex flex-wrap items-center gap-3.5 text-[13px] text-muted-foreground md:ml-auto md:gap-4">
                    {COUNTED_PHASES.map(({ phase, label, tone }) => (
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
                                hasIncident={incidentDevices.has(
                                    station.deviceName
                                )}
                                onPhaseChange={handlePhaseChange}
                            />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
};

export default LiveSolving;
