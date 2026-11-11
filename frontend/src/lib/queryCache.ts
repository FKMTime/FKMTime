import { queryOptions } from "@tanstack/react-query";

import { queryClient } from "./queryClient";

/**
 * Helpers over the app's QueryClient for queries declared in `src/lib`
 * (SPEC-003). A query's TanStack key is `[query.key]`, its request path,
 * so imperative calls here and `useQuery` share the same cache entries.
 */

export interface Query<T> {
    key: string;
    fetch: () => Promise<T>;
}

export class QueryError extends Error {
    constructor(public status: number) {
        super(`Request failed with status ${status}`);
    }
}

/** Options for `useQuery` and friends that share this cache */
export const toQueryOptions = <T>(query: Query<T>) =>
    queryOptions({
        queryKey: [query.key],
        queryFn: query.fetch,
        // Kept until sign-out, as before
        gcTime: Infinity,
    });

const cache = queryClient.getQueryCache();

/** Whether the key was fetched or saved within the last `maxAge` ms */
export const isQueryFresh = (key: string, maxAge: number) => {
    const state = queryClient.getQueryState([key]);
    if (state?.data === undefined) return false;
    return Date.now() - state.dataUpdatedAt < maxAge;
};

/** The cached data, if it was fetched within the last `maxAge` ms */
export const getFreshQueryData = <T>(key: string, maxAge: number) =>
    isQueryFresh(key, maxAge) ? queryClient.getQueryData<T>([key]) : undefined;

/** The cached data, however old */
export const getQueryData = <T>(key: string) =>
    queryClient.getQueryData<T>([key]);

/** Writes data the page already knows, e.g. after a save */
export const setQueryData = <T>(
    key: string,
    data: T | ((previous: T | undefined) => T)
) => {
    // A request started before this write would bring back older data. The
    // cancel is synchronous, so the write below always comes after it.
    void queryClient.cancelQueries({ queryKey: [key], exact: true });
    queryClient.setQueryData<T>([key], (previous) =>
        typeof data === "function"
            ? (data as (previous: T | undefined) => T)(previous)
            : data
    );
};

/**
 * Fetches and caches a query. A fetch while another is loading replaces it
 * once the key has data, and the replaced call resolves with the newer data,
 * so a slow older response can't overwrite a newer one.
 */
export const fetchQuery = <T>(
    query: Query<T>,
    { reuseRunning = false } = {}
): Promise<T> => {
    // Passed to fetch too: a key first written by setQueryData has no queryFn
    const options = queryClient.defaultQueryOptions<T, Error, T, string[]>({
        queryKey: [query.key],
        queryFn: query.fetch,
        gcTime: Infinity,
    });
    return cache
        .build(queryClient, options)
        .fetch(options, { cancelRefetch: !reuseRunning }) as Promise<T>;
};

/** One stable query per parameter, e.g. per round or search term */
export const queryFamily = <T>(create: (param: string) => Query<T>) => {
    const queries = new Map<string, Query<T>>();
    return (param = "") => {
        const query = queries.get(param) ?? create(param);
        queries.set(param, query);
        return query;
    };
};

/**
 * How old cached data on competition-day pages (results, incidents,
 * attendance, persons) may be and still be shown while it refreshes
 */
export const LIVE_MAX_AGE = 30_000;

/**
 * Loads a query in the background unless it's already loading, or cached
 * (within `maxAge` ms when given)
 */
export const prefetchQuery = <T>(
    query: Query<T>,
    { maxAge }: { maxAge?: number } = {}
) => {
    const state = queryClient.getQueryState([query.key]);
    if (state?.fetchStatus === "fetching") return;
    const isCached =
        maxAge === undefined
            ? state?.data !== undefined
            : isQueryFresh(query.key, maxAge);
    if (isCached) return;
    fetchQuery(query).catch(() => undefined);
};

/** Drops everything cached, e.g. when the user signs out */
export const clearQueryCache = () => queryClient.clear();
