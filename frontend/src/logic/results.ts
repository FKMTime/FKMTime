import { Competition } from "@wca/helpers";
import { getLimitByRoundId, getNumberOfAttemptsForRound } from "wcif-helpers";

import { average, best, formattedBest } from "./average";
import { Attempt, Result, ResultWithAverage } from "./interfaces";
import { backendRequest } from "./request";
import { resultToString } from "./resultFormatters";
import { getSubmittedAttempts } from "./utils";

export const getResultsByRoundId = async (roundId: string, search?: string) => {
    let route = `result/round/${roundId}`;
    if (search) {
        route += `?search=${search}`;
    }
    const response = await backendRequest(route, "GET", true);
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
    return await response.json();
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

export const resultsWithAverageProperty = (
    results: Result[],
    wcif: Competition
) => {
    return results.map((result) => {
        const submittedAttempts = getSubmittedAttempts(result.attempts);
        const maxAttempts = getNumberOfAttemptsForRound(result.roundId, wcif);
        const calculatedAverage =
            submittedAttempts.length === maxAttempts &&
            average(submittedAttempts);
        return {
            ...result,
            average: calculatedAverage || 0,
            averageString: calculatedAverage
                ? resultToString(calculatedAverage)
                : "",
            best: best(submittedAttempts) || 0,
            bestString: formattedBest(submittedAttempts) || "",
        };
    });
};

export const orderResultsByAverage = (results: ResultWithAverage[]) => {
    return results.sort((a, b) => {
        if (a.average && b.average) {
            if (a.average === b.average) {
                return a.best - b.best;
            }
            return a.average - b.average;
        }
        if (a.average) {
            return -1;
        } else if (b.average) {
            return 1;
        } else {
            return a.best - b.best;
        }
    });
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
    return response.status;
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

export const undoDoubleCheck = async (roundId: string) => {
    const response = await backendRequest(
        `result/round/${roundId}/double-check`,
        "DELETE",
        true
    );
    return response.status;
};

export const getResultsChecks = async (roundId?: string) => {
    const response = await backendRequest(
        `result/checks${roundId ? `?roundId=${roundId}` : ""}`,
        "GET",
        true
    );
    return await response.json();
};
