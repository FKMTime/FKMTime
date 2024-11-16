import { Scramble } from "./interfaces";
import { scramblingDeviceBackendRequest } from "./request";
import { decryptText } from "./utils";

export const getScrambleSetsForScramblingDevice = async (roundId: string) => {
    const response = await scramblingDeviceBackendRequest(
        `scrambling/sets/round/${roundId}`,
        "GET"
    );
    return await response.json();
};

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
