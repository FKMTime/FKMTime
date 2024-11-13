import { scramblingDeviceBackendRequest } from "./request";

export const getScrambleSetsForScramblingDevice = async (roundId: string) => {
    const response = await scramblingDeviceBackendRequest(
        `scrambling/sets/${roundId}`,
        "GET"
    );
    return await response.json();
};
