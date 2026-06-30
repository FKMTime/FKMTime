import { Attempt, AttemptData, Incident } from "./interfaces";
import { backendRequest } from "./request";

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

export const getIncidentById = async (
    id: string
): Promise<{
    attempt: Incident;
    previousIncidents: Incident[];
}> => {
    const response = await backendRequest(`attempt/${id}`, "GET", true);
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

export const deleteAttempt = async (id: string) => {
    const response = await backendRequest(`attempt/${id}`, "DELETE", true);
    return {
        status: response.status,
        data: await response.json(),
    };
};
