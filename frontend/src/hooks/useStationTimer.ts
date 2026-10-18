import { useEffect, useState } from "react";

import { getStationTimer, StationInfo } from "@/lib/liveSolving";

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

    useEffect(() => {
        if (!timer.isRunning) return;
        const interval = setInterval(() => setNow(Date.now()), 100);
        return () => clearInterval(interval);
    }, [timer.isRunning, station.serverReceivedAt]);

    return timer;
};

export default useStationTimer;
