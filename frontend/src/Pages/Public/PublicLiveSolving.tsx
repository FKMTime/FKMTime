import { useCallback, useContext, useEffect, useMemo, useState } from "react";

import LiveSolvingBoard from "@/Components/shared/LiveSolvingBoard";
import { getPublicRooms } from "@/lib/competition";
import { Room } from "@/lib/interfaces";
import { StationInfo } from "@/lib/liveSolving";
import { socket, SocketContext } from "@/socket";

const PublicLiveSolving = () => {
    const [stations, setStations] = useState<Map<number, StationInfo>>(
        new Map()
    );
    const [rooms, setRooms] = useState<Room[]>([]);

    const [isConnected] = useContext(SocketContext) as [
        number,
        React.Dispatch<React.SetStateAction<number>>,
    ];

    useEffect(() => {
        getPublicRooms().then((data: Room[]) => setRooms(data ?? []));
    }, [isConnected]);

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
