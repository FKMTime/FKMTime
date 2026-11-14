import {
    IntegratedLiveAddableCompetitor,
    IntegratedLiveConnectionStatus,
    IntegratedLiveNoShows,
    IntegratedLiveProblems,
    IntegratedLiveRegistrationRules,
    IntegratedLiveRound,
    IntegratedLiveRoundDetails,
    IntegratedLiveSyncStatus,
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

/** A round's WCA state and the WCA's copy of each result (SPEC-006 section 5) */
export const integratedLiveRoundDetailsQuery = queryFamily((roundId) =>
    backendQuery<IntegratedLiveRoundDetails | null>(
        `competition/integrated-live/rounds/${roundId}/details`
    )
);

/** How often the Results page reads the WCA while a round is on screen */
export const INTEGRATED_LIVE_REFRESH = 10_000;

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

/** Empties one competitor's result in the WCA; FKMTime's is sent again */
export const clearIntegratedLiveResult = (
    roundId: string,
    registrationId: number
) => roundAction(`${roundId}/results/${registrationId}/clear`, "POST");

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

/**
 * The round in WCA live results in one line, e.g. "open, 38 of 40 done, all
 * sent", or why it can't open yet (SPEC-006 section 5)
 */
export const liveStatusLine = (live: IntegratedLiveRoundDetails) => {
    if (live.waitingReason) return live.waitingReason;
    const sending =
        live.needsAttention > 0
            ? `${live.needsAttention} need attention`
            : live.onTheWay > 0
              ? `${live.onTheWay} sending`
              : "all sent";
    switch (live.state) {
        case "open":
            return live.totalCompetitors !== null
                ? `open, ${live.completedCompetitors ?? 0} of ${live.totalCompetitors} done, ${sending}`
                : `open, ${sending}`;
        case "locked":
            return live.needsAttention > 0 ? `done, ${sending}` : "done";
        case "ready":
            return "ready to open";
        default:
            return "not open yet";
    }
};

/** What a sync status that needs someone means, in plain words */
export const ATTENTION_LABELS: Partial<
    Record<IntegratedLiveSyncStatus, string>
> = {
    REJECTED: "Not accepted",
    NOT_IN_ROUND: "Not in round",
    NOT_SENDABLE: "Can't be sent",
};

export const isOnTheWay = (status: IntegratedLiveSyncStatus | null) =>
    status === "DIRTY" || status === "SENT";

/** Results that aren't getting through, by round, for Home's alert */
export const integratedLiveProblemsQuery = backendQuery<IntegratedLiveProblems>(
    "competition/integrated-live/rounds/problems"
);

/** The WCA's rules behind "not registered" results (WCRP 6.4, 5.2.1) */
export const integratedLiveRegistrationRulesQuery =
    backendQuery<IntegratedLiveRegistrationRules | null>(
        "competition/integrated-live/rounds/registration-rules"
    );

/** The competition's registrations on the WCA website */
export const wcaRegistrationsUrl = (wcaId: string) =>
    `${WCA_ORIGIN}/competitions/${wcaId}/registrations/edit`;

const formatDate = (date: string) =>
    new Date(date).toLocaleString("en-GB", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
    });

/**
 * The rule that applies to a result the WCA wouldn't take because of the
 * competitor's registration, in plain words (SPEC-006 section 4), or null
 * for any other reason. FKMTime never changes registrations itself.
 */
export const registrationHint = (
    error: string | null,
    rules: IntegratedLiveRegistrationRules | null | undefined,
    now = new Date()
): string | null => {
    if (error?.startsWith("Not registered for ")) {
        const deadline = rules?.eventChangeDeadline;
        if (deadline && new Date(deadline) >= now) {
            return `They can add the event on the WCA website until ${formatDate(deadline)} (WCRP 6.4). Once it's on their registration, FKMTime adds them to the round by itself.`;
        }
        if (deadline) {
            return `The deadline for adding events was ${formatDate(deadline)}. Only the Delegate can make an exception, for a mistake made while registering (WCRP 6.4.4).`;
        }
        return "With no deadline for adding events, they can add it until the event takes place (WCRP 6.4.2). Once the round has started it's at the Delegate's discretion (WCRP 6.4.2.1). Once it's on their registration, FKMTime adds them to the round by itself.";
    }
    if (error === "No accepted WCA registration") {
        const accept =
            "Competing needs an accepted registration (Regulation 2c1). Once it is accepted on the WCA website, FKMTime picks it up at the next sync.";
        if (rules?.onTheSpotRegistration) {
            return `${accept} On-site registration was advertised, but if the competitor limit${rules.competitorLimit ? ` (${rules.competitorLimit})` : ""} was reached when registration closed, on-site registrations must not be accepted (WCRP 5.2.1).`;
        }
        return accept;
    }
    return null;
};
