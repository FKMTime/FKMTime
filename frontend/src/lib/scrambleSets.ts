import { ScrambleSet } from "./interfaces";
import { queryFamily } from "./queryCache";
import { backendQuery, backendRequest } from "./request";

/** A round's scramble sets */
export const scrambleSetsQuery = queryFamily((roundId) =>
    backendQuery<ScrambleSet[]>(`scramble-set/${roundId}`)
);

export const getScrambleSets = async (roundId: string) => {
    const response = await backendRequest(
        `scramble-set/${roundId}`,
        "GET",
        true
    );
    return await response.json();
};

export const deleteScrambleSet = async (id: string) => {
    const response = await backendRequest(`scramble-set/${id}`, "DELETE", true);
    return response.status;
};

export const deleteScrambleSetsByRoundId = async (roundId: string) => {
    const response = await backendRequest(
        `scramble-set/round/${roundId}`,
        "DELETE",
        true
    );
    return response.status;
};

export const deleteAllScrambleSets = async () => {
    const response = await backendRequest(`scramble-set/all`, "DELETE", true);
    return response.status;
};

export interface ScrambleSetCount {
    roundId: string;
    count: number;
}

export const scrambleSetCountsQuery = backendQuery<ScrambleSetCount[]>(
    "scramble-set/counts"
);

export const getScrambleSetCounts = async (): Promise<ScrambleSetCount[]> => {
    const response = await backendRequest("scramble-set/counts", "GET", true);
    return await response.json();
};

const plural = (count: number, word: string) =>
    `${count} ${word}${count === 1 ? "" : "s"}`;

/** "5 scrambles · 2 extras" */
export const scrambleCountLabel = (set: ScrambleSet) =>
    [
        plural(set.scramblesCount, "scramble"),
        set.extraScramblesCount > 0 && plural(set.extraScramblesCount, "extra"),
    ]
        .filter(Boolean)
        .join(" · ");
