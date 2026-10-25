import { APIRequestContext, expect } from "@playwright/test";

/**
 * Thin wrappers over the backend API for arranging test data. The UI is what
 * the tests exercise; these only put the world into the state a test needs.
 */

export interface ApiPerson {
    id: string;
    name: string;
    registrantId: number | null;
    wcaId: string | null;
    cardId: string | null;
    checkedInAt: string | null;
    canCompete: boolean;
    countryIso2: string | null;
}

const ok = async <T>(
    response: Awaited<ReturnType<APIRequestContext["get"]>>
): Promise<T> => {
    expect(
        response.ok(),
        `${response.url()} -> ${response.status()} ${await response.text()}`
    ).toBeTruthy();
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
};

export const getPersonByRegistrantId = async (
    api: APIRequestContext,
    registrantId: number
) => {
    const body = await ok<{ data: ApiPerson[] }>(
        await api.get(`person?registrantId=${registrantId}&pageSize=1`)
    );
    expect(body.data, `person with registrant id ${registrantId}`).toHaveLength(
        1
    );
    return body.data[0];
};

export const getAllPersons = async (api: APIRequestContext) =>
    ok<ApiPerson[]>(await api.get("person/all"));

export const searchPersons = async (api: APIRequestContext, search: string) =>
    ok<ApiPerson[]>(
        await api.get(`person/all?search=${encodeURIComponent(search)}`)
    );

export const addPerson = async (
    api: APIRequestContext,
    data: {
        name: string;
        gender?: string;
        countryIso2?: string;
        wcaId?: string;
        cardId?: string;
        canCompete?: boolean;
    }
) => {
    await ok(
        await api.post("person", {
            data: { gender: "o", canCompete: false, ...data },
        })
    );
    const [person] = await searchPersons(api, data.name);
    return person;
};

export const assignCard = async (
    api: APIRequestContext,
    personId: string,
    cardId: string
) => ok(await api.put(`person/${personId}`, { data: { cardId } }));

export const checkIn = async (
    api: APIRequestContext,
    personId: string,
    cardId: string
) => ok(await api.post(`person/check-in/${personId}`, { data: { cardId } }));

export type AttemptStatus =
    "STANDARD" | "UNRESOLVED" | "RESOLVED" | "EXTRA_GIVEN" | "SCRAMBLED";

export const createAttempt = async (
    api: APIRequestContext,
    data: {
        roundId: string;
        competitorId: string;
        attemptNumber: number;
        value: number;
        penalty?: number;
        status?: AttemptStatus;
        type?: "STANDARD_ATTEMPT" | "EXTRA_ATTEMPT";
        comment?: string;
        judgeId?: string;
        deviceId?: string;
        replacedBy?: number;
    }
) =>
    ok(
        await api.post("attempt", {
            data: {
                penalty: 0,
                status: "STANDARD",
                type: "STANDARD_ATTEMPT",
                ...data,
            },
        })
    );

export interface ApiAttempt {
    id: string;
    attemptNumber: number;
    value: number;
    penalty: number;
    status: AttemptStatus;
    type: "STANDARD_ATTEMPT" | "EXTRA_ATTEMPT";
    replacedBy: number | null;
    comment: string | null;
}

export interface ApiResult {
    id: string;
    roundId: string;
    isDoubleChecked: boolean;
    attempts: ApiAttempt[];
    person: ApiPerson;
}

/** The person's result in a round; the backend creates an empty one if needed */
export const getResult = async (
    api: APIRequestContext,
    roundId: string,
    personId: string
) => ok<ApiResult>(await api.get(`result/round/${roundId}/person/${personId}`));

/** Enter attempts 1..n with the given times (centiseconds) */
export const createAttempts = async (
    api: APIRequestContext,
    roundId: string,
    competitorId: string,
    values: number[]
) => {
    for (const [index, value] of values.entries()) {
        await createAttempt(api, {
            roundId,
            competitorId,
            attemptNumber: index + 1,
            value,
        });
    }
    return getResult(api, roundId, competitorId);
};

export interface ApiRoom {
    id: string;
    name: string;
    color: string;
    currentGroupIds: string[];
}

export const getRooms = async (api: APIRequestContext) =>
    ok<ApiRoom[]>(await api.get("competition/rooms"));

/** The seed schedule runs groups 1 and 3 of each first round here */
export const STAGE_ONE = "Stage 1";

export const getRoom = async (api: APIRequestContext, name = STAGE_ONE) => {
    const room = (await getRooms(api)).find((r) => r.name === name);
    expect(room, `room ${name}`).toBeTruthy();
    return room!;
};

/** Set the groups running in each room; rooms not listed run nothing */
export const setCurrentGroups = async (
    api: APIRequestContext,
    groupsByRoomName: Record<string, string[]>
) => {
    const rooms = await getRooms(api);
    await ok(
        await api.put("competition/rooms", {
            data: {
                rooms: rooms.map((room) => ({
                    ...room,
                    currentGroupIds: groupsByRoomName[room.name] ?? [],
                })),
            },
        })
    );
};

export interface ApiDevice {
    id: string;
    name: string;
    espId: number;
    roomId: string;
    type: string;
}

export const createDevice = async (
    api: APIRequestContext,
    data: {
        name: string;
        espId: number;
        roomId: string;
        type?: "STATION" | "ATTENDANCE_SCRAMBLER" | "ATTENDANCE_RUNNER";
        hwVersion?: "V3" | "V4";
    }
) =>
    ok<ApiDevice>(
        await api.post("device", {
            data: { type: "STATION", hwVersion: "V3", ...data },
        })
    );

export const getDevices = async (api: APIRequestContext) =>
    ok<ApiDevice[]>(await api.get("device"));
