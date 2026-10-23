import {
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
    cumulativeLimitCentiseconds: null,
    cumulativeRemainingCentiseconds: null,
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

    it("groups stations by their device's room, sorted by ESP ID", () => {
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
