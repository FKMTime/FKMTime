import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import {
    fetchQuery,
    getQueryEntry,
    isQueryFresh,
    Query,
    setQueryData,
    subscribeToQuery,
} from "@/lib/queryCache";

interface CachedQueryOptions {
    /**
     * Cached data older than this many ms isn't shown; the page waits for
     * the refresh instead, so it never passes off old data as current
     */
    maxAge?: number;
    /** While a new key loads (e.g. a new search), keep the last data shown */
    keepPreviousData?: boolean;
}

/**
 * Returns the cached data for a query at once and refreshes it on mount.
 * `data` is undefined only until the first response for the key arrives.
 * `query` must be stable (module-level, from a queryFamily, or memoised).
 */
export const useCachedQuery = <T>(
    query: Query<T>,
    { maxAge, keepPreviousData = false }: CachedQueryOptions = {}
) => {
    const { key } = query;
    const subscribe = useCallback(
        (listener: () => void) => subscribeToQuery(key, listener),
        [key]
    );
    const getSnapshot = useCallback(() => getQueryEntry<T>(key), [key]);
    const entry = useSyncExternalStore(subscribe, getSnapshot);
    const [error, setError] = useState<unknown>(null);

    const isTooOld = (queryKey: string) =>
        maxAge !== undefined && !isQueryFresh(queryKey, maxAge);
    // The key whose cached data is too old to show until it's refreshed
    const [waitingKey, setWaitingKey] = useState(() =>
        isTooOld(key) ? key : null
    );
    const [renderedKey, setRenderedKey] = useState(key);
    if (renderedKey !== key) {
        setRenderedKey(key);
        setWaitingKey(isTooOld(key) ? key : null);
    }

    const load = useCallback(
        async (options?: { reuseRunning: boolean }) => {
            const data = await fetchQuery(query, options);
            setError(null);
            setWaitingKey((waiting) =>
                waiting === query.key ? null : waiting
            );
            return data;
        },
        [query]
    );

    useEffect(() => {
        // A prefetch already on its way counts as the refresh. On failure
        // data that is too old stays hidden: it would look current.
        load({ reuseRunning: true }).catch(setError);
    }, [load]);

    const shownData = waitingKey === key ? undefined : entry?.data;
    const [previousData, setPreviousData] = useState(shownData);
    if (shownData !== undefined && shownData !== previousData) {
        setPreviousData(shownData);
    }

    const refetch = useCallback(() => load(), [load]);
    const setData = useCallback(
        (data: T | ((previous: T | undefined) => T)) => {
            setQueryData(key, data);
            setWaitingKey((waiting) => (waiting === key ? null : waiting));
        },
        [key]
    );

    return {
        data: shownData ?? (keepPreviousData ? previousData : undefined),
        version: entry?.version ?? 0,
        error,
        refetch,
        setData,
    };
};
