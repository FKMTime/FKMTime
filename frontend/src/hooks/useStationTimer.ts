import { useEffect, useState } from "react";

import {
    getStationTimer,
    STATION_OFFLINE_AFTER_MS,
    StationInfo,
} from "@/lib/liveSolving";

const useStationTimer = (station: StationInfo) => {
    const [now, setNow] = useState(Date.now());
    const [packets, setPackets] = useState<{
        current: StationInfo;
        previous: StationInfo | null;
    }>({ current: station, previous: null });

    if (packets.current.serverReceivedAt !== station.serverReceivedAt) {
        setPackets({ current: station, previous: packets.current });
    }

    const timer = getStationTimer(station, packets.previous, now);

    const isOffline = timer.phase === "offline";

    useEffect(() => {
        if (timer.isRunning) {
            const interval = setInterval(() => setNow(Date.now()), 100);
            return () => clearInterval(interval);
        }
        if (isOffline) return;
        // Re-render once the station would cross the offline threshold
        const timeout = setTimeout(
            () => setNow(Date.now()),
            Math.max(
                0,
                station.serverReceivedAt + STATION_OFFLINE_AFTER_MS - Date.now()
            )
        );
        return () => clearTimeout(timeout);
    }, [timer.isRunning, isOffline, station.serverReceivedAt]);

    return timer;
};

export default useStationTimer;
