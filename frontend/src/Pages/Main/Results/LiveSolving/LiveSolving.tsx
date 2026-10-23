import { useCallback, useContext, useEffect, useMemo, useState } from "react";

import LiveSolvingBoard from "@/Components/shared/LiveSolvingBoard";
import { getAllDevices } from "@/lib/devices";
import { Device, DeviceType, Room } from "@/lib/interfaces";
import { StationInfo } from "@/lib/liveSolving";
import { getAllRooms } from "@/lib/rooms";
import { socket, SocketContext } from "@/socket";

interface NewIncidentData {
    id: string;
    deviceName: string;
    competitorName: string;
}

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
    roomId: device.roomId,
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

    const [isConnected] = useContext(SocketContext) as [
        number,
        React.Dispatch<React.SetStateAction<number>>,
    ];

    useEffect(() => {
        getAllRooms().then(setRooms);
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

    const stationList = useMemo(
        () => Array.from(stations.values()),
        [stations]
    );

    return (
        <LiveSolvingBoard
            stations={stationList}
            rooms={rooms}
            incidentDevices={incidentDevices}
            showOfflineCount
        />
    );
};

export default LiveSolving;
