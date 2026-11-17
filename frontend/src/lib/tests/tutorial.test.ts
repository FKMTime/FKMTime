import { describe, expect, it } from "vitest";
import { Competition as WCIF } from "wcif-helpers";

import { Device, DeviceType, HardwareVersion } from "@/lib/interfaces";
import {
    getUpcomingTutorials,
    isInTutorial,
    tutorialNoticeText,
} from "@/lib/tutorial";

const now = new Date("2026-11-17T09:00:00Z");

const station = (overrides: Partial<Device> = {}): Device => ({
    id: "device-1",
    name: "Station 3",
    espId: 3,
    roomId: "room-1",
    type: DeviceType.STATION,
    hwVersion: HardwareVersion.V4,
    createdAt: now,
    updatedAt: now,
    ...overrides,
});

describe("isInTutorial (SPEC-012)", () => {
    it("is on only until its end", () => {
        expect(
            isInTutorial(
                station({ tutorialEndsAt: "2026-11-17T09:10:00Z" }),
                now
            )
        ).toBe(true);
        expect(
            isInTutorial(
                station({ tutorialEndsAt: "2026-11-17T08:59:00Z" }),
                now
            )
        ).toBe(false);
        expect(isInTutorial(station({ tutorialEndsAt: null }), now)).toBe(
            false
        );
    });

    it("never counts a retired station", () => {
        expect(
            isInTutorial(
                station({
                    tutorialEndsAt: "2026-11-17T09:10:00Z",
                    retiredAt: "2026-11-17T08:00:00Z",
                }),
                now
            )
        ).toBe(false);
    });
});

describe("getUpcomingTutorials", () => {
    const wcif = (startTime: string, endTime: string) =>
        ({
            schedule: {
                venues: [
                    {
                        timezone: "Europe/Warsaw",
                        rooms: [
                            {
                                id: 1,
                                name: "Main Hall",
                                activities: [
                                    {
                                        id: 7,
                                        name: "Tutorial for new competitors",
                                        activityCode: "other-tutorial",
                                        startTime,
                                        endTime,
                                    },
                                    {
                                        id: 8,
                                        name: "Lunch",
                                        activityCode: "other-lunch",
                                        startTime: "2026-11-17T08:00:00Z",
                                        endTime: "2026-11-17T10:00:00Z",
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        }) as unknown as WCIF;

    it("suggests a tutorial starting within 15 minutes", () => {
        expect(
            getUpcomingTutorials(
                wcif("2026-11-17T09:14:00Z", "2026-11-17T09:30:00Z"),
                now
            )
        ).toEqual([
            {
                name: "Tutorial for new competitors",
                roomName: "Main Hall",
                startTime: "2026-11-17T09:14:00Z",
                endTime: "2026-11-17T09:30:00Z",
                timezone: "Europe/Warsaw",
                key: "1-7",
            },
        ]);
    });

    it("keeps suggesting it while it runs", () => {
        expect(
            getUpcomingTutorials(
                wcif("2026-11-17T08:45:00Z", "2026-11-17T09:15:00Z"),
                now
            )
        ).toHaveLength(1);
    });

    it("doesn't suggest one too early or once it has ended", () => {
        expect(
            getUpcomingTutorials(
                wcif("2026-11-17T09:16:00Z", "2026-11-17T09:30:00Z"),
                now
            )
        ).toEqual([]);
        expect(
            getUpcomingTutorials(
                wcif("2026-11-17T08:30:00Z", "2026-11-17T09:00:00Z"),
                now
            )
        ).toEqual([]);
    });
});

describe("tutorialNoticeText", () => {
    it("says a station is still in tutorial mode, or that it ended", () => {
        expect(
            tutorialNoticeText({
                kind: "stillOn",
                espId: 3,
                deviceName: "Station 3",
            }).title
        ).toBe("Station 3 is still in tutorial mode");
        expect(
            tutorialNoticeText({
                kind: "endedByGroupStart",
                espId: 3,
                deviceName: "Station 3",
            }).title
        ).toBe("Tutorial on Station 3 ended");
    });
});
