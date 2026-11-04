/**
 * Keeps the last response of each query so a page can render it right away
 * and refresh in the background, instead of showing a loader on every visit.
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

const entries = new Map<string, QueryEntry<unknown>>();
const latestRequests = new Map<string, Promise<unknown>>();
const listeners = new Map<string, Set<() => void>>();

const storeData = <T>(key: string, data: T) => {
    const current = entries.get(key);
    // An unchanged refetch shouldn't re-render or reset a form being edited
    if (current && JSON.stringify(current.data) === JSON.stringify(data)) {
        return;
    }
    entries.set(key, { data, version: (current?.version ?? 0) + 1 });
    listeners.get(key)?.forEach((listener) => listener());
};

export const getQueryEntry = <T>(key: string) =>
    entries.get(key) as QueryEntry<T> | undefined;

/** Writes data the page already knows, e.g. after a save */
export const setQueryData = <T>(
    key: string,
    data: T | ((previous: T | undefined) => T)
) => {
    // A request started before this write would bring back older data
    latestRequests.delete(key);
    const next =
        typeof data === "function"
            ? (data as (previous: T | undefined) => T)(
                  getQueryEntry<T>(key)?.data
              )
            : data;
    storeData(key, next);
};

/**
 * Fetches and caches a query. Only the newest request for a key is stored,
 * so a slow older response can't overwrite a newer one.
 */
export const fetchQuery = <T>(
    query: Query<T>,
    { reuseRunning = false } = {}
): Promise<T> => {
    const running = latestRequests.get(query.key);
    if (reuseRunning && running) return running as Promise<T>;

    const request: Promise<T> = query.fetch().then((data) => {
        if (latestRequests.get(query.key) === request) {
            storeData(query.key, data);
        }
        return data;
    });
    const forget = () => {
        if (latestRequests.get(query.key) === request) {
            latestRequests.delete(query.key);
        }
    };
    request.then(forget, forget);
    latestRequests.set(query.key, request);
    return request;
};

/** Loads a query in the background unless it's cached or already loading */
export const prefetchQuery = <T>(query: Query<T>) => {
    if (entries.has(query.key) || latestRequests.has(query.key)) return;
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
    entries.clear();
    latestRequests.clear();
};
