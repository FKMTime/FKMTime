import { queryOptions } from "@tanstack/react-query";

import { queryClient } from "./queryClient";

/**
 * Keeps the last response of each query so a page can render it right away
 * and refresh in the background, instead of showing a loader on every visit.
 *
 * The data lives in the TanStack Query cache, under the key `[query.key]`,
 * so pages using `useQuery` with `toQueryOptions` share it (SPEC-003).
 */

export interface Query<T> {
    key: string;
    fetch: () => Promise<T>;
}

export interface QueryEntry<T> {
    data: T;
    /** Bumped whenever the data changes, so forms can re-seed their defaults */
    version: number;
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
const entries = new Map<string, QueryEntry<unknown>>();
const listeners = new Map<string, Set<() => void>>();

const notify = (key: string) =>
    listeners.get(key)?.forEach((listener) => listener());

// Versions count changes to the data. Structural sharing keeps the same
// object when a refetch brings equal data, so that doesn't bump the version
// and a form being edited is left alone.
cache.subscribe((event) => {
    const [key, ...rest] = event.query.queryKey;
    if (typeof key !== "string" || rest.length > 0) return;
    if (event.type === "removed") {
        if (entries.delete(key)) notify(key);
        return;
    }
    const data = event.query.state.data;
    const current = entries.get(key);
    if (data === undefined || current?.data === data) return;
    entries.set(key, { data, version: (current?.version ?? 0) + 1 });
    notify(key);
});

export const getQueryEntry = <T>(key: string) =>
    entries.get(key) as QueryEntry<T> | undefined;

/** Whether the key was fetched or saved within the last `maxAge` ms */
export const isQueryFresh = (key: string, maxAge: number) => {
    const state = queryClient.getQueryState([key]);
    if (state?.data === undefined) return false;
    return Date.now() - state.dataUpdatedAt < maxAge;
};

/** The cached data, if it was fetched within the last `maxAge` ms */
export const getFreshQueryData = <T>(key: string, maxAge: number) =>
    isQueryFresh(key, maxAge) ? getQueryEntry<T>(key)?.data : undefined;

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

export const subscribeToQuery = (key: string, listener: () => void) => {
    const keyListeners = listeners.get(key) ?? new Set();
    keyListeners.add(listener);
    listeners.set(key, keyListeners);
    return () => {
        keyListeners.delete(listener);
    };
};

/** Drops everything cached, e.g. when the user signs out */
export const clearQueryCache = () => {
    queryClient.clear();
    entries.clear();
};
