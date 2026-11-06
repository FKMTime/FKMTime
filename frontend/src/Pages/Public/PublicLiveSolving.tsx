import { useMemo, useState } from "react";

import LiveSolvingBoard from "@/Components/shared/LiveSolvingBoard";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useSocketEvents } from "@/hooks/useSocketEvents";
import { useSocketRoom } from "@/hooks/useSocketRoom";
import { publicRoomsQuery } from "@/lib/competition";
import { StationInfo } from "@/lib/liveSolving";

const PublicLiveSolving = () => {
    const [stations, setStations] = useState<Map<number, StationInfo>>(
        new Map()
    );
    const { data: rooms = [] } = useLiveQuery(publicRoomsQuery);

    // Stations stream over the socket; the room is joined again on reconnect
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
    });

    const stationList = useMemo(
        () => Array.from(stations.values()),
        [stations]
    );

    return (
        <LiveSolvingBoard
            stations={stationList}
            rooms={rooms}
            allRoomsLabel="All rooms"
        />
    );
};

export default PublicLiveSolving;
