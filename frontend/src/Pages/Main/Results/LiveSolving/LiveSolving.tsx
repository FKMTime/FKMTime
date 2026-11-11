import { useMemo, useState } from "react";

import LiveSolvingBoard from "@/Components/shared/LiveSolvingBoard";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useSocketEvents } from "@/hooks/useSocketEvents";
import { useSocketRoom } from "@/hooks/useSocketRoom";
import { stationDevicesQuery } from "@/lib/devices";
import { Device } from "@/lib/interfaces";
import { StationInfo } from "@/lib/liveSolving";
import { roomsQuery } from "@/lib/rooms";

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
    timerRunning: null,
    inspectionRunning: null,
    cumulativeLimitCentiseconds: null,
    cumulativeRemainingCentiseconds: null,
    // Never heard from, so it shows as offline until its first packet
    serverReceivedAt: 0,
    lastSolve: null,
});

const LiveSolving = () => {
    const [stations, setStations] = useState<Map<number, StationInfo>>(
        new Map()
    );
    const [incidentDevices, setIncidentDevices] = useState<Set<string>>(
        new Set()
    );

    const { data: rooms = [] } = useLiveQuery(roomsQuery);
    // Every station shows, idle until it sends something
    const { data: devices } = useLiveQuery(stationDevicesQuery);

    const handleCurrentStations = (data: StationInfo[]) => {
        setStations((prev) => {
            const next = new Map(prev);
            data.forEach((s) => next.set(s.espId, s));
            return next;
        });
    };

    const handleCurrentTimeInfo = (data: StationInfo) => {
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
    };

    const handleNewIncident = (data: NewIncidentData) => {
        playIncidentAlert();
        setIncidentDevices((prev) => new Set([...prev, data.deviceName]));
        // An idle station is only in the device list until it sends data
        const idleDevice = devices?.find((d) => d.name === data.deviceName);
        setStations((prev) => {
            const entry =
                [...prev.values()].find(
                    (s) => s.deviceName === data.deviceName
                ) ??
                (idleDevice && idleStation(idleDevice));
            if (!entry) return prev;
            const next = new Map(prev);
            next.set(entry.espId, {
                ...entry,
                personName: data.competitorName,
            });
            return next;
        });
    };

    // Stations stream over the socket; the room is joined again on reconnect
    useSocketRoom("LiveSolving");
    useSocketEvents({
        currentStations: (data) => handleCurrentStations(data as StationInfo[]),
        currentTimeInfo: (data) => handleCurrentTimeInfo(data as StationInfo),
        newIncident: (data) => handleNewIncident(data as NewIncidentData),
    });

    const stationList = useMemo(() => {
        const all = new Map(stations);
        for (const device of devices ?? []) {
            if (!all.has(device.espId))
                all.set(device.espId, idleStation(device));
        }
        return Array.from(all.values());
    }, [stations, devices]);

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
