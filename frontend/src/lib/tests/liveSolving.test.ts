import {
    formatLastSolveTime,
    getStationTimer,
    groupStationsByRoom,
    StationInfo,
} from "@/lib/liveSolving";

const packet = (
    overrides: Partial<StationInfo> & { serverReceivedAt: number }
): StationInfo => ({
    espId: 1,
    deviceName: "1",
    roomId: null,
    personName: "Jane Doe",
    registrantId: 1,
    groupId: "333-r1-g1",
    time: null,
    inspection: null,
    timerRunning: null,
    inspectionRunning: null,
    cumulativeLimitCentiseconds: null,
    cumulativeRemainingCentiseconds: null,
    lastSolve: null,
    ...overrides,
});

describe("getStationTimer", () => {
    it("counts up between packets while the time grows", () => {
        const previous = packet({ time: 1000, serverReceivedAt: 10_000 });
        const current = packet({ time: 2000, serverReceivedAt: 11_000 });

        const timer = getStationTimer(current, previous, 11_500);

        expect(timer.phase).toEqual("solving");
        expect(timer.displayTime).toEqual(250);
        expect(timer.isRunning).toBe(true);
    });

    it("shows the reported time once it stops changing", () => {
        const previous = packet({ time: 7216, serverReceivedAt: 10_000 });
        const current = packet({ time: 7216, serverReceivedAt: 11_000 });

        const timer = getStationTimer(current, previous, 11_900);

        expect(timer.phase).toEqual("finished");
        expect(timer.displayTime).toEqual(721);
        expect(timer.isRunning).toBe(false);
    });

    it("truncates milliseconds instead of rounding", () => {
        const current = packet({ time: 7219, serverReceivedAt: 10_000 });

        expect(getStationTimer(current, null, 10_000).displayTime).toEqual(721);
    });

    it("does not count up from a snapshot without a previous packet", () => {
        const current = packet({ time: 5000, serverReceivedAt: 10_000 });

        const timer = getStationTimer(current, null, 60_000);

        expect(timer.displayTime).toEqual(500);
        expect(timer.isRunning).toBe(false);
    });

    it("stops counting up when the station stops sending packets", () => {
        const previous = packet({ time: 1000, serverReceivedAt: 10_000 });
        const current = packet({ time: 2000, serverReceivedAt: 11_000 });

        const timer = getStationTimer(current, previous, 20_000);

        expect(timer.displayTime).toEqual(200);
        expect(timer.isRunning).toBe(false);
    });

    it("shows a station that stopped sending as offline", () => {
        const previous = packet({ time: 105_000, serverReceivedAt: 10_000 });
        const current = packet({ time: 106_000, serverReceivedAt: 11_000 });

        const timer = getStationTimer(current, previous, 41_000);

        expect(timer.phase).toEqual("offline");
        expect(timer.isRunning).toBe(false);
    });

    it("keeps a quiet station online until the offline threshold", () => {
        const current = packet({ time: 7216, serverReceivedAt: 10_000 });

        expect(getStationTimer(current, null, 39_999).phase).toEqual(
            "finished"
        );
    });

    it("counts up inspection while it grows", () => {
        const previous = packet({ inspection: 3000, serverReceivedAt: 10_000 });
        const current = packet({ inspection: 4000, serverReceivedAt: 11_000 });

        const timer = getStationTimer(current, previous, 11_300);

        expect(timer.phase).toEqual("inspection");
        expect(timer.displayInspection).toEqual(430);
    });

    it("shows the solve rather than inspection once the solve starts", () => {
        const previous = packet({ inspection: 7205, serverReceivedAt: 10_000 });
        const current = packet({
            inspection: 7205,
            time: 900,
            serverReceivedAt: 11_000,
        });

        const timer = getStationTimer(current, previous, 11_000);

        expect(timer.phase).toEqual("solving");
        expect(timer.displayTime).toEqual(90);
    });
});

describe("getStationTimer with running flags", () => {
    it("shows a solve as running from its first packet", () => {
        const current = packet({
            time: 300,
            timerRunning: true,
            inspectionRunning: false,
            serverReceivedAt: 10_000,
        });

        const timer = getStationTimer(current, null, 10_400);

        expect(timer.phase).toEqual("solving");
        expect(timer.displayTime).toEqual(70);
        expect(timer.isRunning).toBe(true);
    });

    it("counts up even when the time did not grow since the last packet", () => {
        const previous = packet({
            time: 0,
            timerRunning: false,
            inspectionRunning: true,
            serverReceivedAt: 10_000,
        });
        const current = packet({
            time: 0,
            timerRunning: true,
            inspectionRunning: false,
            serverReceivedAt: 11_000,
        });

        const timer = getStationTimer(current, previous, 11_250);

        expect(timer.phase).toEqual("solving");
        expect(timer.displayTime).toEqual(25);
    });

    it("stops at the reported time as soon as the station stops", () => {
        const previous = packet({
            time: 8000,
            timerRunning: true,
            serverReceivedAt: 10_000,
        });
        const current = packet({
            time: 8437,
            timerRunning: false,
            inspectionRunning: false,
            serverReceivedAt: 10_437,
        });

        const timer = getStationTimer(current, previous, 11_200);

        expect(timer.phase).toEqual("finished");
        expect(timer.displayTime).toEqual(843);
        expect(timer.isRunning).toBe(false);
    });

    it("stops counting up when a running station stops sending packets", () => {
        const current = packet({
            time: 2000,
            timerRunning: true,
            serverReceivedAt: 10_000,
        });

        const timer = getStationTimer(current, null, 20_000);

        expect(timer.displayTime).toEqual(200);
        expect(timer.isRunning).toBe(false);
    });

    it("shows inspection as running from its first packet", () => {
        const current = packet({
            inspection: 1000,
            timerRunning: false,
            inspectionRunning: true,
            serverReceivedAt: 10_000,
        });

        const timer = getStationTimer(current, null, 10_600);

        expect(timer.phase).toEqual("inspection");
        expect(timer.displayInspection).toEqual(160);
        expect(timer.isRunning).toBe(true);
    });

    it("holds inspection still once the station reports it stopped", () => {
        const previous = packet({
            inspection: 3000,
            inspectionRunning: true,
            serverReceivedAt: 10_000,
        });
        const current = packet({
            inspection: 4000,
            timerRunning: false,
            inspectionRunning: false,
            serverReceivedAt: 11_000,
        });

        const timer = getStationTimer(current, previous, 11_500);

        expect(timer.phase).toEqual("inspection");
        expect(timer.displayInspection).toEqual(400);
        expect(timer.isRunning).toBe(false);
    });

    it("falls back to growth between packets when the flags are null", () => {
        const previous = packet({ time: 1000, serverReceivedAt: 10_000 });
        const growing = packet({ time: 2000, serverReceivedAt: 11_000 });
        const still = packet({ time: 1000, serverReceivedAt: 11_000 });

        expect(getStationTimer(growing, previous, 11_500)).toEqual({
            phase: "solving",
            displayTime: 250,
            displayInspection: null,
            isRunning: true,
        });
        expect(getStationTimer(still, previous, 11_500)).toEqual({
            phase: "finished",
            displayTime: 100,
            displayInspection: null,
            isRunning: false,
        });
        expect(getStationTimer(growing, null, 11_500).isRunning).toBe(false);
    });
});

describe("groupStationsByRoom", () => {
    const rooms = [
        { id: "main", name: "Main Room", currentGroupIds: ["333-r1-g2"] },
        {
            id: "side",
            name: "Side Room",
            currentGroupIds: ["222-r1-g1", "222-r1-g2", "pyram-r1-g1"],
        },
        { id: "empty", name: "Empty Room", currentGroupIds: [] },
    ];
    const station = (espId: number, roomId: string | null) =>
        packet({ espId, roomId, serverReceivedAt: 0 });

    it("sorts stations by device name, numbers in numeric order", () => {
        const named = (espId: number, deviceName: string) =>
            packet({ espId, deviceName, roomId: "main", serverReceivedAt: 0 });
        const groups = groupStationsByRoom(
            [
                named(1, "Station 10"),
                named(2, "Station 2"),
                named(3, "Judge A"),
            ],
            rooms
        );

        expect(groups[0].stations.map((s) => s.deviceName)).toEqual([
            "Judge A",
            "Station 2",
            "Station 10",
        ]);
    });

    it("groups stations by their device's room, by ESP ID for equal names", () => {
        const groups = groupStationsByRoom(
            [station(3, "main"), station(1, "main"), station(2, "side")],
            rooms
        );

        expect(groups.map((group) => group.id)).toEqual(["main", "side"]);
        expect(groups[0].stations.map((s) => s.espId)).toEqual([1, 3]);
        expect(groups[0].roundIds).toEqual(["333-r1"]);
        expect(groups[1].roundIds).toEqual(["222-r1", "pyram-r1"]);
    });

    it("puts stations without a known room last", () => {
        const groups = groupStationsByRoom(
            [station(9, null), station(1, "main"), station(5, "deleted")],
            rooms
        );

        expect(groups.map((group) => group.name)).toEqual([
            "Main Room",
            "Other stations",
        ]);
        expect(groups[1].stations.map((s) => s.espId)).toEqual([5, 9]);
    });
});

describe("formatLastSolveTime", () => {
    const solve = (value: number, penalty: number) => ({
        personName: "Jane Doe",
        value,
        penalty,
        enteredAt: 0,
    });

    it("shows the time with any penalty added", () => {
        expect(formatLastSolveTime(solve(1234, 0))).toBe("12.34");
        expect(formatLastSolveTime(solve(1234, 2))).toBe("14.34");
    });

    it("shows a DNF instead of the time", () => {
        expect(formatLastSolveTime(solve(1234, -1))).toBe("DNF");
    });
});
