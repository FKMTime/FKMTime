import { Scramble, ScrambleSet } from "./interfaces";
import { Query, queryFamily } from "./queryCache";
import { scramblingDeviceBackendRequest } from "./request";
import { decryptText } from "./utils";

export const getScrambleSetsForScramblingDevice = async (roundId: string) => {
    const response = await scramblingDeviceBackendRequest(
        `scrambling/sets/round/${roundId}`,
        "GET"
    );
    return await response.json();
};

/** A round's scramble sets, as a scrambling device sees them */
export const scramblingDeviceSetsQuery = queryFamily(
    (roundId): Query<ScrambleSet[]> => ({
        key: `scrambling/sets/round/${roundId}`,
        fetch: () => getScrambleSetsForScramblingDevice(roundId),
    })
);

export const getScrambleSetById = async (id: string) => {
    const response = await scramblingDeviceBackendRequest(
        `scrambling/sets/${id}`,
        "GET"
    );
    return await response.json();
};

export const unlockScrambleSet = async (id: string, password: string) => {
    const response = await scramblingDeviceBackendRequest(
        `scrambling/sets/${id}/unlock`,
        "POST",
        { password }
    );
    return {
        status: response.status,
        data: await response.json(),
    };
};

export const getScramblingDeviceRoom = async () => {
    const response = await scramblingDeviceBackendRequest(
        "scrambling/room",
        "GET"
    );
    return await response.json();
};

export const decryptScrambles = (
    encryptedScrambles: Scramble[],
    password: string
) => {
    return encryptedScrambles.map((scramble) => {
        const scrambleText = decryptText(scramble.encryptedScramble, password);
        return {
            ...scramble,
            scramble: scrambleText,
        };
    });
};

export const getScrambleData = async (cardId: string, roundId: string) => {
    const response = await scramblingDeviceBackendRequest(
        `scrambling/scramble/${cardId}/${roundId}`,
        "GET"
    );
    return {
        status: response.status,
        data: await response.json(),
    };
};

export const getPersonByCardId = async (cardId: string) => {
    const response = await scramblingDeviceBackendRequest(
        `scrambling/person/${cardId}`,
        "GET"
    );
    return await response.json();
};

export const createScrambledAttempt = async (
    personId: string,
    scramblerId: string,
    roundId: string,
    attemptNumber: number,
    isExtra: boolean
) => {
    const response = await scramblingDeviceBackendRequest(
        "scrambling/scramble",
        "POST",
        {
            personId,
            scramblerId,
            roundId,
            attemptNumber,
            isExtra,
        }
    );
    return {
        status: response.status,
        data: await response.json(),
    };
};
