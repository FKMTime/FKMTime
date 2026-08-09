import { useAtomValue } from "jotai";
import { CheckCircle2, Radio, TriangleAlert } from "lucide-react";
import {
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import { getPersonFromWcif } from "wcif-helpers";

import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import { Badge } from "@/Components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { activityCodeToName } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";
import { getAllDevices } from "@/lib/devices";
import { Device, DeviceType } from "@/lib/interfaces";
import { cn } from "@/lib/utils";
import { centisecondsToClockFormat } from "@/lib/resultFormatters";
import PageTransition from "@/Pages/PageTransition";
import { socket, SocketContext } from "@/socket";

interface StationInfo {
    espId: number;
    deviceName: string;
    personName: string | null;
    registrantId: number | null;
    groupId: string | null;
    time: number | null;
    inspection: number | null;
    cumulativeLimitCentiseconds: number | null;
    cumulativeRemainingCentiseconds: number | null;
    serverReceivedAt: number;
}

interface NewIncidentData {
    id: string;
    deviceName: string;
    competitorName: string;
}

const STALE_THRESHOLD_MS = 30_000;

const formatCs = (cs: number) => {
    try {
        return centisecondsToClockFormat(Math.max(0, cs));
    } catch {
        return "0.00";
    }
};

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
    beep(t,        880, 0.12);
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
    serverReceivedAt: Date.now(),
});

const StationCard = ({
    station,
    competition,
    hasIncident,
}: {
    station: StationInfo;
    competition: ReturnType<typeof useAtomValue<typeof competitionAtom>>;
    hasIncident: boolean;
}) => {
    const [now, setNow] = useState(Date.now());
    const [flashing, setFlashing] = useState(false);
    const prevHasIncident = useRef(false);
    // Track previous packet's time to detect when the timer freezes (solve finished)
    const prevTimeMsRef = useRef<number | null>(null);
    const timerFrozenRef = useRef(false);

    useEffect(() => {
        if (hasIncident && !prevHasIncident.current) {
            setFlashing(true);
            const t = setTimeout(() => setFlashing(false), 1800);
            return () => clearTimeout(t);
        }
        prevHasIncident.current = hasIncident;
    }, [hasIncident]);

    // Runs on every new packet (serverReceivedAt changes). Detects frozen timer
    // by comparing current time value with the previous packet's time value.
    useEffect(() => {
        if (station.time != null && station.time > 0) {
            timerFrozenRef.current = station.time === prevTimeMsRef.current;
        } else {
            timerFrozenRef.current = false;
        }
        prevTimeMsRef.current = station.time ?? null;
    }, [station.serverReceivedAt]);

    const hasTimerData = station.time != null || station.inspection != null;
    const isFinished =
        now - station.serverReceivedAt > STALE_THRESHOLD_MS &&
        station.personName != null;
    const isActive = hasTimerData && !isFinished;

    useEffect(() => {
        if (!isActive) return;
        const interval = setInterval(() => setNow(Date.now()), 100);
        return () => clearInterval(interval);
    }, [isActive, station.serverReceivedAt]);

    // ESP sends time/inspection in milliseconds; divide by 10 to get centiseconds
    const timeCs = station.time != null ? Math.round(station.time / 10) : null;
    const inspectionCs =
        station.inspection != null
            ? Math.round(station.inspection / 10)
            : null;

    // Derive stable reference points for smooth interpolation between packets
    const solveStartMs =
        station.time != null && station.time > 0
            ? station.serverReceivedAt - station.time
            : null;
    const inspectionStartMs =
        station.inspection != null
            ? station.serverReceivedAt - station.inspection
            : null;

    // When the timer is frozen (solve done), show the exact final time.
    // Otherwise interpolate from the derived start time for a smooth running display.
    const displayTime =
        timerFrozenRef.current || solveStartMs == null || isFinished
            ? timeCs
            : Math.max(0, Math.round((now - solveStartMs) / 10));
    const displayInspection =
        inspectionStartMs != null && !isFinished
            ? Math.max(0, Math.round((now - inspectionStartMs) / 10))
            : inspectionCs;

    const wcifPerson =
        competition && station.registrantId
            ? getPersonFromWcif(station.registrantId, competition.wcif)
            : null;

    const avatarUrl = wcifPerson?.avatar?.thumbUrl ?? undefined;
    const initials = station.personName?.[0]?.toUpperCase() ?? "?";

    const roundId = station.groupId?.split("-g")[0] ?? null;
    let roundName: string | null = null;
    if (roundId) {
        try {
            roundName = activityCodeToName(roundId, true, true);
        } catch {
            roundName = null;
        }
    }

    const phase = isFinished
        ? "finished"
        : timeCs != null && timeCs > 0
          ? "solving"
          : displayInspection != null
            ? "inspection"
            : "idle";

    return (
        <Card
            className={cn(
                hasIncident && "border-destructive border-2",
                flashing && "incident-flash"
            )}
        >
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <span className="text-sm font-semibold text-muted-foreground">
                    {station.deviceName}
                </span>
                <div className="flex items-center gap-1.5">
                    {roundName && (
                        <Badge variant="outline" className="text-xs">
                            {roundName}
                        </Badge>
                    )}
                    {hasIncident && (
                        <Badge
                            variant="destructive"
                            className="text-xs gap-1 animate-pulse"
                        >
                            <TriangleAlert size={10} />
                            Incident
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                        <AvatarImage src={avatarUrl} />
                        <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium truncate">
                        {station.personName ?? "No competitor"}
                    </span>
                </div>

                <div className="flex flex-col items-center gap-1">
                    {phase === "finished" && (
                        <>
                            <div className="flex items-center gap-1.5 text-blue-500">
                                <CheckCircle2 size={14} />
                                <span className="text-xs font-medium uppercase tracking-wider">
                                    Finished
                                </span>
                            </div>
                            {station.time != null && (
                                <span className="text-4xl font-mono font-bold">
                                    {formatCs(station.time)}
                                </span>
                            )}
                        </>
                    )}
                    {phase === "inspection" && displayInspection != null && (
                        <>
                            <span className="text-xs text-amber-500 font-medium uppercase tracking-wider">
                                Inspection
                            </span>
                            <span className="text-4xl font-mono font-bold text-amber-500">
                                {formatCs(displayInspection)}
                            </span>
                        </>
                    )}
                    {phase === "solving" && displayTime != null && (
                        <>
                            <span className="text-xs text-green-500 font-medium uppercase tracking-wider">
                                Solving
                            </span>
                            <span className="text-4xl font-mono font-bold text-green-500">
                                {formatCs(displayTime)}
                            </span>
                        </>
                    )}
                    {phase === "idle" && (
                        <span className="text-muted-foreground text-sm">
                            Waiting
                        </span>
                    )}
                </div>

                {station.cumulativeLimitCentiseconds != null &&
                    station.cumulativeRemainingCentiseconds != null && (
                        <div className="border-t pt-2 text-xs text-muted-foreground flex justify-between">
                            <span>Cumulative limit</span>
                            <span className="font-mono">
                                {formatCs(
                                    station.cumulativeRemainingCentiseconds
                                )}{" "}
                                /{" "}
                                {formatCs(station.cumulativeLimitCentiseconds)}{" "}
                                remaining
                            </span>
                        </div>
                    )}
            </CardContent>
        </Card>
    );
};

const LiveSolving = () => {
    const competition = useAtomValue(competitionAtom);
    const [stations, setStations] = useState<Map<number, StationInfo>>(
        new Map()
    );
    const [incidentDevices, setIncidentDevices] = useState<Set<string>>(
        new Set()
    );

    const [isConnected] = useContext(SocketContext) as [
        number,
        React.Dispatch<React.SetStateAction<number>>,
    ];

    useEffect(() => {
        getAllDevices(DeviceType.STATION).then((devices: Device[]) => {
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
            next.set(entry.espId, { ...entry, personName: data.competitorName });
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
    }, [handleCurrentStations, handleCurrentTimeInfo, handleNewIncident, isConnected]);

    const stationList = Array.from(stations.values()).sort(
        (a, b) => a.espId - b.espId
    );

    return (
        <PageTransition>
            <div className="flex flex-col gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Radio size={20} />
                            Live solving
                        </CardTitle>
                    </CardHeader>
                </Card>

                {stationList.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-8">
                        No active stations. Times will appear here once devices
                        start sending data.
                    </p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {stationList.map((station) => (
                            <StationCard
                                key={station.espId}
                                station={station}
                                competition={competition}
                                hasIncident={incidentDevices.has(
                                    station.deviceName
                                )}
                            />
                        ))}
                    </div>
                )}
            </div>
        </PageTransition>
    );
};

export default LiveSolving;
