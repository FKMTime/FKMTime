import { afterEach, describe, expect, it, vi } from "vitest";

import { backendRequest } from "@/lib/request";
import {
    AttemptFormValues,
    buildAttemptPacket,
    buildCardScanPacket,
    generateCardId,
    generateSessionId,
    hasCard,
    sendStationPacket,
} from "@/lib/stationTester";

vi.mock("@/lib/request", () => ({ backendRequest: vi.fn() }));

const attempt: AttemptFormValues = {
    timeMs: "10305",
    penalty: 2,
    inspectionTimeMs: "5000",
    competitorCard: "123",
    judgeCard: "456",
    espId: "789",
    groupId: "",
    sessionId: "session",
    solvedAt: "",
    isDelegate: false,
};

describe("buildAttemptPacket", () => {
    const now = new Date("2026-01-02T03:04:05.000Z");

    it("sends both the centiseconds and the milliseconds a station sends", () => {
        expect(buildAttemptPacket(attempt, now)).toMatchObject({
            value: 1030,
            valueMs: 10305,
            penalty: 2,
            inspectionTime: 5000,
            competitorId: 123,
            judgeId: 456,
            espId: 789,
            sessionId: "session",
            solvedAt: now.toISOString(),
        });
    });

    it("leaves out what a station wouldn't send", () => {
        const packet = buildAttemptPacket({ ...attempt, judgeCard: "" }, now);

        expect(packet.judgeId).toBeUndefined();
        expect(packet.groupId).toBeUndefined();
    });

    it("keeps custom values", () => {
        const solvedAt = "2020-01-01T00:00:00.000Z";

        expect(
            buildAttemptPacket(
                { ...attempt, solvedAt, groupId: "333-r1-g2" },
                now
            )
        ).toMatchObject({ solvedAt, groupId: "333-r1-g2" });
    });
});

describe("buildCardScanPacket", () => {
    it("sends the card as a string, as stations do", () => {
        expect(
            buildCardScanPacket({ card: "123", espId: "4", isCompetitor: true })
        ).toEqual({ cardId: "123", espId: 4, isCompetitor: true });
    });
});

describe("generators", () => {
    it("generates a different session ID each time", () => {
        expect(generateSessionId()).toHaveLength(32);
        expect(generateSessionId()).not.toBe(generateSessionId());
    });

    it("generates a card a number input can hold", () => {
        expect(generateCardId()).toMatch(/^[1-9]\d{8}$/);
    });
});

describe("hasCard", () => {
    it.each([
        ["123", true],
        ["0", false],
        ["", false],
        [undefined, false],
    ])("treats %s as %s", (cardId, expected) => {
        expect(hasCard(cardId)).toBe(expected);
    });
});

describe("sendStationPacket", () => {
    const respond = (status: number, body: unknown) =>
        vi.mocked(backendRequest).mockResolvedValue({
            ok: status < 400,
            status,
            json: async () => body,
        } as Response);

    afterEach(() => vi.clearAllMocks());

    it("returns the packet as sent and the reply to it", async () => {
        const sent = { type: "PersonInfo", tag: 5, data: {} };
        const reply = { type: "PersonInfoResp", tag: 5, data: {} };
        respond(200, { sent, reply });

        expect(await sendStationPacket("PersonInfo", {})).toEqual({
            sent,
            reply,
            failed: false,
        });
    });

    it("marks a refused packet as failed", async () => {
        const sent = { type: "PersonInfo", tag: 5, data: {} };
        const reply = { type: "Error", tag: 5, data: {}, error: true };
        respond(200, { sent, reply });

        expect((await sendStationPacket("PersonInfo", {})).failed).toBe(true);
    });

    it("shows an HTTP error as the reply", async () => {
        const body = { statusCode: 504, message: "No reply to PersonInfo" };
        respond(504, body);

        expect(await sendStationPacket("PersonInfo", { a: 1 })).toEqual({
            sent: { type: "PersonInfo", data: { a: 1 } },
            reply: body,
            failed: true,
        });
    });

    it("shows an unreachable backend as the reply", async () => {
        vi.mocked(backendRequest).mockRejectedValue(new Error("Failed"));

        const { reply, failed } = await sendStationPacket("PersonInfo", {});

        expect(failed).toBe(true);
        expect(reply).toEqual({ error: "Error: Failed" });
    });
});
