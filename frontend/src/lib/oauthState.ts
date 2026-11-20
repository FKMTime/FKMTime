/**
 * OAuth `state` for the WCA sign-in flows. A random value is kept in this
 * tab's sessionStorage before going to the WCA, and the code that comes back is
 * only used when the WCA returns the same value, so a link carrying someone
 * else's code can't sign anyone in or swap the live results connection.
 */
export type OAuthFlow = "login" | "integrated-live";

const storageKey = (flow: OAuthFlow) => `fkmtime-oauth-state-${flow}`;

/** Makes and remembers a new state value for a sign-in about to start */
export const createOAuthState = (flow: OAuthFlow) => {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const state = Array.from(bytes, (b) =>
        b.toString(16).padStart(2, "0")
    ).join("");
    sessionStorage.setItem(storageKey(flow), state);
    return state;
};

/** True only for the sign-in this tab started; each value works once */
export const takeOAuthState = (flow: OAuthFlow, returned: string | null) => {
    const expected = sessionStorage.getItem(storageKey(flow));
    sessionStorage.removeItem(storageKey(flow));
    return !!expected && !!returned && returned === expected;
};
