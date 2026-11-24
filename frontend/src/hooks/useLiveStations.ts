import { useMemo, useState } from "react";

import { StationInfo, StationRemoved, withoutStation } from "@/lib/liveSolving";

import { useSocketEvents } from "./useSocketEvents";
import { useSocketRoom } from "./useSocketRoom";

/**
 * Every station's live packets, for pages outside live solving that show a
 * competitor's timer. Joins the live solving room while mounted.
 */
export const useLiveStations = () => {
    const [stations, setStations] = useState<Map<number, StationInfo>>(
        new Map()
    );
    useSocketRoom("LiveSolving");
    useSocketEvents({
        currentStations: (data) =>
            setStations(
                new Map((data as StationInfo[]).map((s) => [s.espId, s]))
            ),
        currentTimeInfo: (data) => {
            const station = data as StationInfo;
            setStations((prev) => new Map(prev).set(station.espId, station));
        },
        stationRemoved: (data) => {
            const { espId } = data as StationRemoved;
            setStations((prev) => withoutStation(prev, espId));
        },
    });
    return useMemo(() => Array.from(stations.values()), [stations]);
};
