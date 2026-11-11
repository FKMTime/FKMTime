import { randomUUID } from "node:crypto";
import * as net from "node:net";

import { SOCKET_PATH } from "../env";

interface StationResponse {
    type: string;
    tag?: number;
    error?: boolean;
    data: {
        message?: string;
        status?: number;
        error?: boolean;
        [key: string]: unknown;
    };
}

/**
 * Speaks the hardware protocol over the backend's unix socket the way an
 * FKMTime station or attendance device does: NUL-terminated JSON packets,
 * answers matched by tag. Used to produce what only devices produce
 * (connection requests, solves called in by a delegate, live times).
 */
export class Station {
    private socket: net.Socket;
    private buffer = Buffer.alloc(0);
    private nextTag = 1;
    private pending = new Map<number, (response: StationResponse) => void>();

    private constructor(socket: net.Socket) {
        this.socket = socket;
        socket.on("data", (chunk) => {
            this.buffer = Buffer.concat([this.buffer, chunk]);
            let end = this.buffer.indexOf(0);
            while (end !== -1) {
                const packet = JSON.parse(
                    this.buffer.subarray(0, end).toString()
                ) as StationResponse;
                this.buffer = this.buffer.subarray(end + 1);
                end = this.buffer.indexOf(0);
                if (packet.tag !== undefined) {
                    this.pending.get(packet.tag)?.(packet);
                    this.pending.delete(packet.tag);
                }
            }
        });
    }

    static connect(): Promise<Station> {
        return new Promise((resolve, reject) => {
            const socket = net.createConnection(SOCKET_PATH);
            socket.once("connect", () => resolve(new Station(socket)));
            socket.once("error", reject);
        });
    }

    send(type: string, data: unknown): Promise<StationResponse> {
        const tag = this.nextTag++;
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pending.delete(tag);
                reject(new Error(`No answer to ${type} (tag ${tag})`));
            }, 10_000);
            this.pending.set(tag, (response) => {
                clearTimeout(timeout);
                resolve(response);
            });
            this.socket.write(JSON.stringify({ type, tag, data }) + "\0");
        });
    }

    requestToConnect(espId: number, type: "STATION" | "STAFF_ATTENDANCE") {
        return this.send("RequestToConnectDevice", {
            espId,
            signKey: 0,
            type,
            hw: "v3",
        });
    }

    /** A solve as the station reports it; `isDelegate` calls the delegate */
    enterAttempt(attempt: {
        espId: number;
        competitorCardId: string;
        judgeCardId?: string;
        valueCs: number;
        penalty?: number;
        isDelegate?: boolean;
        groupId?: string;
    }) {
        return this.send("EnterAttempt", {
            value: attempt.valueCs,
            valueMs: attempt.valueCs * 10,
            penalty: attempt.penalty ?? 0,
            inspectionTime: 8000,
            solvedAt: new Date().toISOString(),
            espId: attempt.espId,
            competitorId: Number(attempt.competitorCardId),
            judgeId: Number(attempt.judgeCardId ?? 0),
            isDelegate: attempt.isDelegate ?? false,
            sessionId: randomUUID(),
            groupId: attempt.groupId,
        });
    }

    /** The running timer a station streams while a solve is in progress */
    currentTime(info: {
        espId: number;
        timeCs?: number;
        inspection?: number;
        competitorCardId?: string;
        groupId?: string;
    }) {
        return this.send("CurrentTimeInfo", {
            espId: info.espId,
            time: info.timeCs,
            inspection: info.inspection,
            competitor:
                info.competitorCardId !== undefined
                    ? Number(info.competitorCardId)
                    : undefined,
            groupId: info.groupId,
        });
    }

    createAttendance(espId: number, cardId: string) {
        return this.send("CreateAttendance", {
            espId,
            cardId: Number(cardId),
        });
    }

    close() {
        this.socket.destroy();
    }
}
