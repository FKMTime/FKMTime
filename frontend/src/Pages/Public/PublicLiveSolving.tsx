import { useCallback, useContext, useEffect, useState } from "react";

import EmptyState from "@/Components/shared/EmptyState";
import LiveStationCard from "@/Components/shared/LiveStationCard";
import { StationInfo } from "@/lib/liveSolving";
import { socket, SocketContext } from "@/socket";

const PublicLiveSolving = () => {
    const [stations, setStations] = useState<Map<number, StationInfo>>(
        new Map()
    );

    const [isConnected] = useContext(SocketContext) as [
        number,
        React.Dispatch<React.SetStateAction<number>>,
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

    if (stationList.length === 0)
        return (
            <EmptyState>
                No active stations. Times will appear here once devices start
                sending data.
            </EmptyState>
        );

    return (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] md:gap-3">
            {stationList.map((station) => (
                <LiveStationCard key={station.espId} station={station} />
            ))}
        </div>
    );
};

export default PublicLiveSolving;
