import { Competition } from "wcif-helpers";
import { getLimitByRoundId, getRoundInfoFromWcif } from "wcif-helpers";

import { Attempt, AttemptData, Incident, Result } from "./interfaces";
import { queryFamily } from "./queryCache";
import { queryClient } from "./queryClient";
import { backendQuery, backendRequest } from "./request";

export const getResultsByRoundId = async (roundId: string, search?: string) => {
    let route = `result/round/${roundId}`;
    if (search) {
        route += `?search=${search}`;
    }
    const response = await backendRequest(route, "GET", true);
    return (await response.json()) || [];
};

/** A round's results without a search, as the Rounds tab first shows them */
export const roundResultsQuery = queryFamily((roundId) =>
    backendQuery<Result[]>(`result/round/${roundId}`)
);

const searchedRoundResults = queryFamily((path) =>
    backendQuery<Result[]>(path)
);

/** A round's results matching a search; no search is the full round */
export const roundResultsSearchQuery = (roundId: string, search: string) =>
    search
        ? searchedRoundResults(
              `result/round/${roundId}?search=${encodeURIComponent(search)}`
          )
        : roundResultsQuery(roundId);

/** Refetches a round's results on screen, searched or not */
export const invalidateRoundResults = (roundId: string) => {
    const path = roundResultsQuery(roundId).key;
    return queryClient.invalidateQueries({
        predicate: ({ queryKey: [key] }) =>
            typeof key === "string" &&
            (key === path || key.startsWith(`${path}?`)),
    });
};

/** A round's results as the public pages show them, without signing in */
export const publicRoundResultsQuery = queryFamily((roundId) =>
    backendQuery<Result[]>(`result/public/round/${roundId}`, {
        useAuth: false,
    })
);

export const getPublicResultsByRoundId = async (
    roundId: string,
    search?: string
) => {
    let route = `result/public/round/${roundId}`;
    if (search) {
        route += `?search=${search}`;
    }
    const response = await backendRequest(route, "GET", false);
    return (await response.json()) || [];
};

export const getAllResultsByPersonId = async (id: string) => {
    const response = await backendRequest(`result/person/${id}`, "GET", true);
    return await response.json();
};

export const getResultById = async (id: string) => {
    const response = await backendRequest(`result/${id}`, "GET", true);
    return {
        data: await response.json(),
        status: response.status,
    };
};

export const deleteResultById = async (id: string) => {
    const response = await backendRequest(`result/${id}`, "DELETE", true);
    return response.status;
};

export const reSubmitScorecardToWcaLive = async (id: string) => {
    const response = await backendRequest(`result/${id}/enter`, "GET", true);
    const data = await response.json();
    return {
        status: response.status,
        data,
    };
};

export const reSubmitRoundToWcaLive = async (roundId: string) => {
    const response = await backendRequest(
        `result/round/${roundId}/enter`,
        "POST",
        true
    );
    return response.status;
};

export const checkTimeLimit = (
    time: number,
    wcif: Competition,
    roundId: string
) => {
    const timeLimit = getLimitByRoundId(roundId, wcif);
    if (!timeLimit) {
        return true;
    }
    return time < timeLimit.centiseconds;
};

export const restartGroup = async (id: string) => {
    const response = await backendRequest(
        `result/group/${id}/restart`,
        "DELETE",
        true
    );
    return response.status;
};

export const assignDnsOnRemainingSolves = async (id: string) => {
    const response = await backendRequest(
        `result/${id}/assign-dns`,
        "POST",
        true
    );
    return {
        data: await response.json(),
        status: response.status,
    };
};

export const getResultsToDoubleCheckByRoundId = async (roundId: string) => {
    const response = await backendRequest(
        `result/round/${roundId}/double-check`,
        "GET",
        true
    );
    return await response.json();
};

export const doubleCheckResult = async (
    resultId: string,
    attempts: Attempt[]
) => {
    const response = await backendRequest(`result/double-check`, "POST", true, {
        resultId,
        attempts,
    });
    return response.status;
};

export const getPersonsWithNoResultsByRoundId = async (roundId: string) => {
    const response = await backendRequest(
        `result/round/${roundId}/missing-persons`,
        "GET",
        true
    );
    return await response.json();
};

export const undoDoubleCheck = async (roundId: string) => {
    const response = await backendRequest(
        `result/round/${roundId}/double-check`,
        "DELETE",
        true
    );
    return response.status;
};

/** Checks for one round, or for all of them with an empty round id */
export const resultsChecksQuery = queryFamily((roundId) =>
    backendQuery<Incident[]>(
        `result/checks${roundId ? `?roundId=${roundId}` : ""}`
    )
);

export const getRankingFromPreviousRound = (
    roundId: string,
    registrantId: number,
    wcif?: Competition
) => {
    if (!wcif) return null;
    const previousRoundId =
        roundId.split("-")[0] +
        "-r" +
        (parseInt(roundId.split("-")[1].replace("r", "")) - 1);
    const round = getRoundInfoFromWcif(previousRoundId, wcif);
    if (!round) {
        return null;
    }
    const pos = round.results.find((r) => r.personId === registrantId)?.ranking;
    return pos !== undefined ? pos : null;
};

export const getResultByRoundIdAndPersonId = async (
    roundId: string,
    personId: string
) => {
    const response = await backendRequest(
        `result/round/${roundId}/person/${personId}`,
        "GET",
        true
    );
    return {
        data: await response.json(),
        status: response.status,
    };
};

export const enterScorecard = async (data: {
    resultId: string;
    attempts: Attempt[];
    newAttempts: AttemptData[];
}) => {
    const response = await backendRequest(
        `attempt/scorecard`,
        "POST",
        true,
        data
    );
    return {
        status: response.status,
        data: await response.json(),
    };
};
