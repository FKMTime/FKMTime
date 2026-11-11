import { QueryClient } from "@tanstack/react-query";

/** The one cache for server data, configured as SPEC-003 describes */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Venue networks can fool the browser's online check, so always
            // send the request and let it fail if the server is unreachable
            networkMode: "always",
            retry: 2,
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
