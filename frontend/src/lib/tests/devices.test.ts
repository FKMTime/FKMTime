import { describe, expect, it } from "vitest";

import {
    getPointedStations,
    joinNames,
    runDifferentRoundSummary,
} from "@/lib/devices";
import { Device, DeviceType } from "@/lib/interfaces";

const device = (overrides: Partial<Device>) =>
    ({
        id: "d",
        name: "Station",
        type: DeviceType.STATION,
        customRoundId: null,
        retiredAt: null,
        ...overrides,
    }) as Device;

describe("stations running another round (SPEC-007)", () => {
    it("finds stations pointed at a round, ignoring retired devices", () => {
        const pointed = device({ id: "1", customRoundId: "333-r1" });
        expect(
            getPointedStations([
                pointed,
                device({ id: "2" }),
                device({
                    id: "3",
                    customRoundId: "333-r1",
                    retiredAt: "2026-05-01T10:00:00Z",
                }),
                device({
                    id: "4",
                    type: DeviceType.ATTENDANCE_RUNNER,
                    customRoundId: "333-r1",
                }),
            ])
        ).toEqual([pointed]);
    });

    it("joins station names the way a sentence would", () => {
        expect(joinNames(["Station 1"])).toBe("Station 1");
        expect(joinNames(["Station 1", "Station 2", "Station 3"])).toBe(
            "Station 1, Station 2 and Station 3"
        );
        expect(joinNames([])).toBe("");
    });

    it("says what pointing does", () => {
        expect(runDifferentRoundSummary(["Station 3"], "333-r1")).toBe(
            "Station 3 will only take attempts for 3x3x3 Cube, Round 1. Other stations carry on with their room's groups."
        );
    });
});
