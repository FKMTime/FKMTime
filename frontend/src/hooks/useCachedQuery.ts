import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import {
    fetchQuery,
    getQueryEntry,
    Query,
    setQueryData,
    subscribeToQuery,
} from "@/lib/queryCache";

/**
 * Returns the cached data for a query at once and refreshes it on mount.
 * `data` is undefined only until the first response for the key arrives.
 * `query` must be stable (module-level or memoised).
 */
export const useCachedQuery = <T>(query: Query<T>) => {
    const { key } = query;
    const subscribe = useCallback(
        (listener: () => void) => subscribeToQuery(key, listener),
        [key]
    );
    const getSnapshot = useCallback(() => getQueryEntry<T>(key), [key]);
    const entry = useSyncExternalStore(subscribe, getSnapshot);
    const [error, setError] = useState<unknown>(null);

    useEffect(() => {
        // A prefetch already on its way counts as the refresh
        fetchQuery(query, { reuseRunning: true }).then(
            () => setError(null),
            setError
        );
    }, [query]);

    const refetch = useCallback(() => fetchQuery(query), [query]);
    const setData = useCallback(
        (data: T | ((previous: T | undefined) => T)) => setQueryData(key, data),
        [key]
    );

    return {
        data: entry?.data,
        version: entry?.version ?? 0,
        error,
        refetch,
        setData,
    };
};
