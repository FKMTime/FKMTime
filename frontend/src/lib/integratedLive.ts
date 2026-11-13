import {
    IntegratedLiveAddableCompetitor,
    IntegratedLiveConnectionStatus,
    IntegratedLiveNoShows,
    IntegratedLiveRound,
    IntegratedLiveWithdrawalPreview,
    IntegratedLiveWithdrawalResult,
} from "./interfaces";
import { queryFamily } from "./queryCache";
import { queryClient } from "./queryClient";
import {
    backendQuery,
    backendRequest,
    WCA_CLIENT_ID,
    WCA_ORIGIN,
} from "./request";

export const integratedLiveConnectionQuery =
    backendQuery<IntegratedLiveConnectionStatus>(
        "competition/integrated-live/connection"
    );

/** Where the WCA sends the user back after connecting */
export const INTEGRATED_LIVE_CONNECT_PATH = "/competition/wca-live-connect";

const redirectUri = () =>
    `${window.location.origin}${INTEGRATED_LIVE_CONNECT_PATH}`;

/** Sends the user to the WCA to sign in as the person results are entered as */
export const startIntegratedLiveConnect = () => {
    const queryParams = new URLSearchParams({
        redirect_uri: redirectUri(),
        // The same scope as the login (SPEC-006 section 2)
        scope: "public manage_competitions",
        response_type: "code",
        client_id: WCA_CLIENT_ID,
    });
    window.location.href = `${WCA_ORIGIN}/oauth/authorize?${queryParams.toString()}`;
};

export const connectIntegratedLive = async (code: string) => {
    const response = await backendRequest(
        "competition/integrated-live/connection",
        "POST",
        true,
        { code, redirectUri: redirectUri() }
    );
    const data = await response.json();
    return { status: response.status, data };
};

export const disconnectIntegratedLive = async () => {
    const response = await backendRequest(
        "competition/integrated-live/connection",
        "DELETE",
        true
    );
    return response.status;
};

export const integratedLiveRoundsQuery = backendQuery<IntegratedLiveRound[]>(
    "competition/integrated-live/rounds"
);

/** What argues against opening a later round yet */
export const integratedLiveBlockersQuery = queryFamily((roundId) =>
    backendQuery<string[]>(
        `competition/integrated-live/rounds/${roundId}/blockers`
    )
);

export const integratedLiveAddableQuery = queryFamily((roundId) =>
    backendQuery<IntegratedLiveAddableCompetitor[]>(
        `competition/integrated-live/rounds/${roundId}/addable`
    )
);

const roundAction = async (
    path: string,
    method: string,
    body?: unknown
): Promise<{ ok: boolean; message: string; personId?: string | null }> => {
    const response = await backendRequest(
        `competition/integrated-live/rounds/${path}`,
        method,
        true,
        body
    );
    const data = await response.json().catch(() => ({}));
    return {
        ok: response.ok && data.ok !== false,
        message: data.message ?? "Something went wrong",
        personId: data.personId,
    };
};

export const openIntegratedLiveRound = (roundId: string) =>
    roundAction(`${roundId}/open`, "POST");

export const closeIntegratedLiveRound = (roundId: string) =>
    roundAction(`${roundId}/close`, "DELETE");

export const addCompetitorToIntegratedLiveRound = (
    roundId: string,
    registrationId: number
) => roundAction(`${roundId}/competitors`, "POST", { registrationId });

/** Rounds and their checks changed: refetch everything that shows them */
export const invalidateIntegratedLiveRounds = () =>
    queryClient.invalidateQueries({
        predicate: (query) =>
            String(query.queryKey[0]).startsWith(
                "competition/integrated-live/rounds"
            ),
    });

/** Finished rounds with competitors who never came (SPEC-006 section 4) */
export const integratedLiveNoShowsQuery = backendQuery<IntegratedLiveNoShows[]>(
    "competition/integrated-live/rounds/no-shows"
);

export const removeNoShows = (roundId: string, registrationIds: number[]) =>
    roundAction(`${roundId}/no-shows`, "POST", { registrationIds });

export const clearIntegratedLiveRound = (roundId: string) =>
    roundAction(`${roundId}/clear`, "POST");

export const previewWithdrawal = async (
    roundId: string,
    personId: string
): Promise<IntegratedLiveWithdrawalPreview> => {
    const response = await backendRequest(
        `competition/integrated-live/rounds/${roundId}/withdrawal/${personId}`,
        "GET",
        true
    );
    return response.json();
};

export const withdrawFromRound = async (
    roundId: string,
    personId: string,
    advancingIds: number[]
): Promise<IntegratedLiveWithdrawalResult> => {
    const response = await backendRequest(
        `competition/integrated-live/rounds/${roundId}/withdrawal/${personId}`,
        "POST",
        true,
        { advancingIds }
    );
    return response.json();
};

/** Puts a replacement, or someone added to a round, into a group */
export const placeInGroup = async (
    roundId: string,
    personId: string,
    groupId: string
) => {
    const response = await backendRequest(
        `competition/integrated-live/rounds/${roundId}/group-placement`,
        "POST",
        true,
        { personId, groupId }
    );
    const data = await response.json().catch(() => ({}));
    return {
        ok: response.ok,
        message: data.error ?? data.message ?? "The group could not be changed",
    };
};
