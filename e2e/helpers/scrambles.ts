import { APIRequestContext, expect } from "@playwright/test";
import * as CryptoJS from "crypto-js";

/** Password the generated scramble files are encrypted with */
export const SCRAMBLES_PASSWORD = "e2e-scramble-password";

const MOVES = ["R", "U", "F", "L", "D", "B"];

/**
 * A short valid scramble, different for every set and number. The app only
 * checks that decrypted text contains spaces; a real move sequence keeps the
 * scramble preview happy too.
 */
const scrambleText = (set: number, num: number, extra: boolean) =>
    [set, num, extra ? 1 : 0, set + num, 2]
        .map(
            (n, i) => `${MOVES[(n + i) % MOVES.length]}${["", "'", "2"][n % 3]}`
        )
        .join(" ");

/**
 * A TNoodle-style "encrypted scrambles" export: a WCIF whose scramble sets
 * hold AES-encrypted scrambles, as the import page expects.
 */
export const buildScramblesFile = (
    rounds: { roundId: string; sets: number }[],
    password = SCRAMBLES_PASSWORD
) => {
    const byEvent = new Map<string, { id: string; scrambleSets: object[] }[]>();
    for (const { roundId, sets } of rounds) {
        const eventId = roundId.split("-")[0];
        const scrambleSets = Array.from({ length: sets }, (_, set) => ({
            id: set + 1,
            scrambles: Array.from({ length: 5 }, (_, i) =>
                CryptoJS.AES.encrypt(
                    scrambleText(set, i, false),
                    password
                ).toString()
            ),
            extraScrambles: Array.from({ length: 2 }, (_, i) =>
                CryptoJS.AES.encrypt(
                    scrambleText(set, i, true),
                    password
                ).toString()
            ),
        }));
        byEvent.set(eventId, [
            ...(byEvent.get(eventId) ?? []),
            { id: roundId, scrambleSets },
        ]);
    }
    const wcif = {
        formatVersion: "1.0",
        events: [...byEvent.entries()].map(([id, eventRounds]) => ({
            id,
            rounds: eventRounds.map((round) => ({
                ...round,
                format: "a",
                timeLimit: null,
                cutoff: null,
                advancementCondition: null,
                results: [],
                scrambleSetCount: round.scrambleSets.length,
                extensions: [],
            })),
            extensions: [],
        })),
    };
    return Buffer.from(JSON.stringify({ wcif }));
};

/** Import encrypted scramble sets for one round straight through the API */
export const importScrambleSets = async (
    api: APIRequestContext,
    roundId: string,
    sets: number
) => {
    const scrambleSets = Array.from({ length: sets }, (_, set) => ({
        roundId,
        set: String.fromCharCode(65 + set),
        scrambles: [
            ...Array.from({ length: 5 }, (_, i) => ({
                num: i + 1,
                encryptedScramble: CryptoJS.AES.encrypt(
                    scrambleText(set, i, false),
                    SCRAMBLES_PASSWORD
                ).toString(),
                isExtra: false,
            })),
            ...Array.from({ length: 2 }, (_, i) => ({
                num: i + 1,
                encryptedScramble: CryptoJS.AES.encrypt(
                    scrambleText(set, i, true),
                    SCRAMBLES_PASSWORD
                ).toString(),
                isExtra: true,
            })),
        ],
    }));
    const response = await api.post("scramble-set/import", {
        data: { scrambleSets },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
};
