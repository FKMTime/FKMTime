export interface StationInfo {
    espId: number;
    deviceName: string;
    personName: string | null;
    registrantId: number | null;
    groupId: string | null;
    // Milliseconds, as reported by the station
    time: number | null;
    inspection: number | null;
    cumulativeLimitCentiseconds: number | null;
    cumulativeRemainingCentiseconds: number | null;
    serverReceivedAt: number;
}

export type StationPhase =
    | "offline"
    | "idle"
    | "inspection"
    | "solving"
    | "finished";

export interface StationTimer {
    phase: StationPhase;
    // Centiseconds
    displayTime: number | null;
    displayInspection: number | null;
    isRunning: boolean;
}

// Stations send a packet every second; older than this, stop counting up.
export const LIVE_PACKET_MAX_AGE_MS = 2_500;
// No packet for this long means the station is asleep or disconnected, and
// its last reported values are no longer meaningful.
export const STATION_OFFLINE_AFTER_MS = 30_000;

// The station keeps reporting its last time and inspection values after they
// stop changing (stackmat stopped or switched off), so a value is live only
// while it grows between consecutive packets.
const isGrowing = (
    current: number | null,
    previous: StationInfo | null,
    key: "time" | "inspection"
) => previous != null && current != null && current > (previous[key] ?? 0);

// WCA regulations truncate (not round) to centiseconds.
const toCentiseconds = (ms: number) => Math.floor(ms / 10);

export const getStationTimer = (
    station: StationInfo,
    previous: StationInfo | null,
    now: number
): StationTimer => {
    const sincePacket = Math.max(0, now - station.serverReceivedAt);
    const isFresh = sincePacket < LIVE_PACKET_MAX_AGE_MS;

    const isTimeRunning = isFresh && isGrowing(station.time, previous, "time");
    const isInspectionRunning =
        isFresh &&
        !isTimeRunning &&
        isGrowing(station.inspection, previous, "inspection");

    const displayTime =
        station.time != null
            ? toCentiseconds(station.time + (isTimeRunning ? sincePacket : 0))
            : null;
    const displayInspection =
        station.inspection != null
            ? toCentiseconds(
                  station.inspection + (isInspectionRunning ? sincePacket : 0)
              )
            : null;

    const phase: StationPhase = isTimeRunning
        ? "solving"
        : sincePacket >= STATION_OFFLINE_AFTER_MS
          ? "offline"
          : displayTime != null && displayTime > 0
            ? "finished"
            : displayInspection != null
              ? "inspection"
              : "idle";

    return {
        phase,
        displayTime,
        displayInspection,
        isRunning: isTimeRunning || isInspectionRunning,
    };
};

export interface StationRoom {
    id: string;
    name: string;
    currentGroupIds: string[];
}

export interface StationRoomGroup {
    id: string;
    name: string;
    /** Round ids in progress in the room, e.g. ["333-r1"] */
    roundIds: string[];
    stations: StationInfo[];
}

export const OTHER_STATIONS_ID = "other";

const toRoundIds = (groupIds: string[]) => [
    ...new Set(groupIds.map((groupId) => groupId.split("-g")[0])),
];

/**
 * Stations grouped by the room their device belongs to, in room order and by
 * ESP ID within a room. Stations without a known room (a device deleted since
 * its last packet) go last, under "Other stations".
 */
export const groupStationsByRoom = (
    stations: StationInfo[],
    roomIdByEspId: Map<number, string>,
    rooms: StationRoom[]
): StationRoomGroup[] => {
    const sorted = [...stations].sort((a, b) => a.espId - b.espId);
    const roomIds = new Set(rooms.map((room) => room.id));
    const groups: StationRoomGroup[] = rooms.map((room) => ({
        id: room.id,
        name: room.name,
        roundIds: toRoundIds(room.currentGroupIds),
        stations: sorted.filter(
            (station) => roomIdByEspId.get(station.espId) === room.id
        ),
    }));
    const other = sorted.filter(
        (station) => !roomIds.has(roomIdByEspId.get(station.espId) ?? "")
    );
    if (other.length)
        groups.push({
            id: OTHER_STATIONS_ID,
            name: "Other stations",
            roundIds: [],
            stations: other,
        });
    return groups.filter((group) => group.stations.length);
};
