import { IntegratedLiveConnectionStatus } from "./interfaces";
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
