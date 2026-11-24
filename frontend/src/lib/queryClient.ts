import { QueryClient } from "@tanstack/react-query";

import { QueryError } from "./queryError";

/**
 * Retries a failed query up to twice, to ride out short network drops,
 * but not when the server refused it: a 403 or 404 gives the same answer
 * on every try. Timeouts and rate limits (408, 429) are still retried.
 */
export const shouldRetryQuery = (failureCount: number, error: Error) => {
    if (
        error instanceof QueryError &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 408 &&
        error.status !== 429
    ) {
        return false;
    }
    return failureCount < 2;
};

/** The one cache for server data, configured as SPEC-003 describes */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Venue networks can fool the browser's online check, so always
            // send the request and let it fail if the server is unreachable
            networkMode: "always",
            retry: shouldRetryQuery,
            refetchOnWindowFocus: false,
            // Socket reconnects drive refetching instead (useRefetchOnReconnect)
            refetchOnReconnect: false,
        },
        mutations: { networkMode: "always" },
    },
});

/**
 * How long rooms and competition data are shared before a page refetches
 * them. No socket event announces changes to either.
 */
export const SHARED_DATA_STALE_TIME = 30_000;

// Rooms and competition settings are read by many pages; share them for a
// while instead of refetching on every page change
for (const path of [
    "competition/rooms",
    "competition/public/rooms",
    "competition/settings",
]) {
    queryClient.setQueryDefaults([path], { staleTime: SHARED_DATA_STALE_TIME });
}
