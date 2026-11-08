import {
    Attempt,
    AttemptData,
    AttemptEditLogEntry,
    Incident,
    RecentAttempt,
} from "./interfaces";
import { queryFamily } from "./queryCache";
import { backendQuery, backendRequest } from "./request";

interface UpdateAttemptData extends Attempt {
    updateReplacedBy?: boolean;
}

export const createAttempt = async (
    data: AttemptData
): Promise<{ status: number; message?: string }> => {
    const response = await backendRequest("attempt", "POST", true, data);
    const message = !response.ok ? (await response.json()).message : undefined;
    return { status: response.status, message };
};

/** Resolves to null when the attempt no longer exists (e.g. it was deleted) */
export const getIncidentById = async (
    id: string
): Promise<{
    attempt: Incident;
    previousIncidents: Incident[];
} | null> => {
    const response = await backendRequest(`attempt/${id}`, "GET", true);
    if (response.status === 404) return null;
    return await response.json();
};

export const swapAttempts = async (
    firstAttemptId: string,
    secondAttemptId: string
) => {
    const response = await backendRequest("attempt/swap", "PUT", true, {
        firstAttemptId,
        secondAttemptId,
    });
    return response.status;
};

export const updateAttempt = async (
    data: UpdateAttemptData,
    isNoteworthy?: boolean,
    doNotRequireCards?: boolean
): Promise<{ status: number; message?: string }> => {
    const response = await backendRequest(`attempt/${data.id}`, "PUT", true, {
        ...data,
        noteworthy: isNoteworthy,
        doNotRequireCards: doNotRequireCards,
    });
    const message = !response.ok ? (await response.json()).message : undefined;
    return { status: response.status, message };
};

/** A round's latest attempts, for the home page */
export const recentAttemptsQuery = queryFamily((roundId) =>
    backendQuery<RecentAttempt[]>(`attempt/round/${roundId}/recent`)
);

export const getRecentAttemptsByRoundId = async (roundId: string) => {
    const response = await backendRequest(
        `attempt/round/${roundId}/recent`,
        "GET",
        true
    );
    return await response.json();
};

export const reorderAttempts = async (
    attemptIds: string[],
    resultId: string
): Promise<number> => {
    const response = await backendRequest("attempt/reorder", "PUT", true, {
        attemptIds,
        resultId,
    });
    return response.status;
};

export const setAttemptReplacement = async (
    id: string,
    replacedByExtraNumber: number | null
): Promise<number> => {
    const response = await backendRequest(
        `attempt/${id}/replacement`,
        "PUT",
        true,
        { replacedByExtraNumber }
    );
    return response.status;
};

export interface ExtraGrantState {
    id: string;
    usingOriginals: boolean;
    attemptIds: string[];
}

export interface ExtrasContext {
    hasNextGroup: boolean;
    nextRoundStarted: boolean;
    grant: ExtraGrantState | null;
}

/** What giving extras for all attempts would do for a result */
export const extrasContextQuery = queryFamily((resultId) =>
    backendQuery<ExtrasContext>(`attempt/give-extras-for-all/${resultId}`)
);

export const getExtrasContext = async (
    resultId: string
): Promise<ExtrasContext> => {
    const response = await backendRequest(
        `attempt/give-extras-for-all/${resultId}`,
        "GET",
        true
    );
    return await response.json();
};

export const giveExtras = async (data: {
    resultId: string;
    attemptIds: string[];
    comment: string;
    useFreshSet: boolean;
    removeFromLive: boolean;
}): Promise<{ status: number; message?: string }> => {
    const response = await backendRequest(
        "attempt/give-extras-for-all",
        "POST",
        true,
        data
    );
    const message = !response.ok ? (await response.json()).message : undefined;
    return { status: response.status, message };
};

export const restoreExtraGrant = async (
    grantId: string
): Promise<{ status: number; message?: string }> => {
    const response = await backendRequest(
        "attempt/restore-extra-grant",
        "POST",
        true,
        { grantId }
    );
    const message = !response.ok ? (await response.json()).message : undefined;
    return { status: response.status, message };
};

export const reapplyExtraGrant = async (
    grantId: string
): Promise<{ status: number; message?: string }> => {
    const response = await backendRequest(
        "attempt/reapply-extra-grant",
        "POST",
        true,
        { grantId }
    );
    const message = !response.ok ? (await response.json()).message : undefined;
    return { status: response.status, message };
};

/** Rule attempts DNF, keeping their times */
export const dnfAttempts = async (data: {
    attemptIds: string[];
    comment: string;
}): Promise<{ status: number; message?: string }> => {
    const response = await backendRequest("attempt/dnf", "POST", true, data);
    const message = !response.ok ? (await response.json()).message : undefined;
    return { status: response.status, message };
};

export const restoreDnfAttempts = async (
    resultId: string
): Promise<{ status: number; message?: string }> => {
    const response = await backendRequest("attempt/restore-dnf", "POST", true, {
        resultId,
    });
    const message = !response.ok ? (await response.json()).message : undefined;
    return { status: response.status, message };
};

/** Every change made to an attempt */
export const attemptEditLogQuery = queryFamily((id) =>
    backendQuery<AttemptEditLogEntry[]>(`attempt/${id}/edit-log`)
);

export const getAttemptEditLog = async (
    id: string
): Promise<AttemptEditLogEntry[]> => {
    const response = await backendRequest(
        `attempt/${id}/edit-log`,
        "GET",
        true
    );
    return await response.json();
};

export const deleteAttempt = async (id: string) => {
    const response = await backendRequest(`attempt/${id}`, "DELETE", true);
    return {
        status: response.status,
        data: await response.json(),
    };
};
