import { getAvailablePenalties, getMaxPenalty } from "@/lib/events";

const penaltyValues = (eventId: string, current?: number) =>
    getAvailablePenalties(eventId, current).map((p) => p.value);

describe("penalties", () => {
    beforeEach(() => {
        localStorage.setItem(
            "fkmtime-events",
            JSON.stringify([
                { id: "333", name: "3x3x3 Cube", icon: "event-333" },
                {
                    id: "clock",
                    name: "Clock",
                    icon: "event-clock",
                    maxPenalty: 14,
                },
            ])
        );
    });

    it("caps clock at +14", () => {
        expect(getMaxPenalty("clock")).toBe(14);
        expect(penaltyValues("clock")).toContain(14);
        expect(penaltyValues("clock")).not.toContain(16);
    });

    it("offers up to +16 in other events", () => {
        expect(getMaxPenalty("333")).toBe(16);
        expect(penaltyValues("333")).toContain(16);
    });

    it("keeps DNF and DNS", () => {
        expect(penaltyValues("clock")).toEqual(
            expect.arrayContaining([-1, -2, 0, 2])
        );
    });

    it("still lists a saved penalty over the cap", () => {
        expect(penaltyValues("clock", 16)).toContain(16);
    });
});
