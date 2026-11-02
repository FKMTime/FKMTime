import { backendRequest } from "./request";

export interface StationPacket {
    type: string;
    tag?: number;
    data: unknown;
}

/** One send: the packet as it went out and whatever came back, verbatim */
export interface StationExchange {
    sent: StationPacket;
    reply: unknown;
    failed: boolean;
}

export interface AttemptFormValues {
    timeMs: string;
    penalty: number;
    inspectionTimeMs: string;
    competitorCard: string;
    judgeCard: string;
    espId: string;
    groupId: string;
    sessionId: string;
    solvedAt: string;
    isDelegate: boolean;
}

export interface CardScanFormValues {
    card: string;
    espId: string;
    isCompetitor: boolean;
}

export interface ConnectDeviceFormValues {
    espId: string;
    signKey: string;
    type: string;
    hw: string;
}

const randomDigits = (length: number) =>
    Array.from(crypto.getRandomValues(new Uint8Array(length)), (byte, index) =>
        index === 0 ? 1 + (byte % 9) : byte % 10
    ).join("");

/** crypto.randomUUID only exists on https and localhost, not on a LAN address */
export const generateSessionId = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
        byte.toString(16).padStart(2, "0")
    ).join("");

export const generateCardId = () => randomDigits(9);
export const generateEspId = () => randomDigits(5);
export const generateSignKey = () => randomDigits(9);

export const hasCard = (cardId?: string | null) => !!cardId && cardId !== "0";

export const buildAttemptPacket = (
    values: AttemptFormValues,
    now = new Date()
) => ({
    value: Math.floor(+values.timeMs / 10),
    valueMs: +values.timeMs,
    penalty: values.penalty,
    inspectionTime: +values.inspectionTimeMs,
    solvedAt: values.solvedAt || now.toISOString(),
    espId: +values.espId,
    judgeId: values.judgeCard ? +values.judgeCard : undefined,
    competitorId: +values.competitorCard,
    isDelegate: values.isDelegate,
    sessionId: values.sessionId,
    groupId: values.groupId || undefined,
});

export const buildCardScanPacket = (values: CardScanFormValues) => ({
    cardId: values.card,
    espId: +values.espId,
    isCompetitor: values.isCompetitor,
});

export const buildConnectDevicePacket = (values: ConnectDeviceFormValues) => ({
    espId: +values.espId,
    signKey: +values.signKey,
    type: values.type,
    hw: values.hw,
});

export const sendStationPacket = async (
    type: string,
    data: unknown
): Promise<StationExchange> => {
    try {
        const response = await backendRequest(
            "station-tester/send",
            "POST",
            true,
            { type, data }
        );
        const body = await response.json();
        if (!response.ok) {
            return { sent: { type, data }, reply: body, failed: true };
        }
        return {
            sent: body.sent,
            reply: body.reply,
            failed: !!body.reply.error,
        };
    } catch (error) {
        return {
            sent: { type, data },
            reply: { error: String(error) },
            failed: true,
        };
    }
};
