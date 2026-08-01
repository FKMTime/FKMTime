import { useAtomValue } from "jotai";
import { CheckCircle2, Radio } from "lucide-react";
import {
    Dispatch,
    SetStateAction,
    useCallback,
    useContext,
    useEffect,
    useState,
} from "react";
import { getPersonFromWcif } from "wcif-helpers";

import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import { Badge } from "@/Components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { activityCodeToName } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";
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

const STALE_THRESHOLD_MS = 30_000;


const formatCs = (cs: number) => {
    try {
        return centisecondsToClockFormat(Math.max(0, cs));
    } catch {
        return "0.00";
    }
};

const StationCard = ({ station, competition }: { station: StationInfo; competition: ReturnType<typeof useAtomValue<typeof competitionAtom>> }) => {
    const [now, setNow] = useState(Date.now());

    const hasTimerData = station.time != null || station.inspection != null;
    const isFinished = now - station.serverReceivedAt > STALE_THRESHOLD_MS && station.personName != null;
    const isActive = hasTimerData && !isFinished;

    useEffect(() => {
        if (!isActive) return;
        const interval = setInterval(() => setNow(Date.now()), 100);
        return () => clearInterval(interval);
    }, [isActive, station.serverReceivedAt]);

    const elapsed = Math.floor((now - station.serverReceivedAt) / 10);

    const displayTime = station.time != null && !isFinished ? station.time + elapsed : station.time;
    const displayInspection = station.inspection != null && !isFinished ? station.inspection + elapsed : station.inspection;

    const wcifPerson =
        competition && station.registrantId
            ? getPersonFromWcif(station.registrantId, competition.wcif)
            : null;

    const avatarUrl = wcifPerson?.avatar?.thumbUrl ?? undefined;
    const initials = station.personName?.[0]?.toUpperCase() ?? "?";

    const roundId = station.groupId?.split("-g")[0] ?? null;
    const roundName = roundId ? activityCodeToName(roundId, true, true) : null;

    const phase = isFinished
        ? "finished"
        : displayInspection != null
          ? "inspection"
          : displayTime != null
            ? "solving"
            : "idle";

    return (
        <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <span className="text-sm font-semibold text-muted-foreground">
                    {station.deviceName}
                </span>
                {roundName && (
                    <Badge variant="outline" className="text-xs">
                        {roundName}
                    </Badge>
                )}
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
                                {formatCs(
                                    station.cumulativeLimitCentiseconds
                                )}{" "}
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
    const [stations, setStations] = useState<Map<number, StationInfo>>(new Map());

    const [isConnected] = useContext(SocketContext) as [
        number,
        Dispatch<SetStateAction<number>>,
    ];

    const handleCurrentStations = useCallback((data: StationInfo[]) => {
        setStations(new Map(data.map((s) => [s.espId, s])));
    }, []);

    const handleCurrentTimeInfo = useCallback((data: StationInfo) => {
        setStations((prev) => {
            const next = new Map(prev);
            next.set(data.espId, data);
            return next;
        });
    }, []);

    useEffect(() => {
        socket.emit("joinLiveSolving");
        socket.on("currentStations", handleCurrentStations);
        socket.on("currentTimeInfo", handleCurrentTimeInfo);

        return () => {
            socket.emit("leaveLiveSolving");
            socket.off("currentStations", handleCurrentStations);
            socket.off("currentTimeInfo", handleCurrentTimeInfo);
        };
    }, [handleCurrentStations, handleCurrentTimeInfo, isConnected]);

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
                            />
                        ))}
                    </div>
                )}
            </div>
        </PageTransition>
    );
};

export default LiveSolving;
