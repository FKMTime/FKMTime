import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { isQueryFresh, Query, toQueryOptions } from "@/lib/queryCache";
import { queryClient } from "@/lib/queryClient";

interface LiveQueryOptions {
    /**
     * Cached data older than this many ms isn't shown; the page waits for
     * the refresh instead, so it never passes off old data as current
     */
    maxAge?: number;
    /** While a new key loads (e.g. a new search), keep the last data shown */
    keepPreviousData?: boolean;
    /** Off: don't fetch, and show only what's cached */
    enabled?: boolean;
}

/** When the key's data was stored, if it's too old to show */
const hiddenSince = (key: string, maxAge: number | undefined) =>
    maxAge !== undefined && !isQueryFresh(key, maxAge)
        ? queryClient.getQueryState([key])?.dataUpdatedAt ?? 0
        : null;

/**
 * `useQuery` for a query from `src/lib`, with options for pages that must
 * not show old data or blank while a new key loads (SPEC-003). Data is refreshed on mount and by invalidation.
 * `query` must be stable (module-level, from a queryFamily, or memoised).
 */
export const useLiveQuery = <T>(
    query: Query<T>,
    { maxAge, keepPreviousData = false, enabled = true }: LiveQueryOptions = {}
) => {
    const { key } = query;
    const result = useQuery({ ...toQueryOptions(query), enabled });

    // Data too old to show stays hidden until data newer than it arrives,
    // and stays hidden if that refresh fails: it would look current
    const [hidden, setHidden] = useState(() => ({
        key,
        since: hiddenSince(key, maxAge),
    }));
    if (hidden.key !== key) {
        setHidden({ key, since: hiddenSince(key, maxAge) });
    }
    const isHidden =
        hidden.key === key &&
        hidden.since !== null &&
        result.dataUpdatedAt <= hidden.since;
    const shownData = isHidden ? undefined : result.data;

    const [previousData, setPreviousData] = useState(shownData);
    if (shownData !== undefined && shownData !== previousData) {
        setPreviousData(shownData);
    }

    // Counts changes to the data, so forms keyed on it re-seed. A refetch
    // that brings equal data keeps the same object, so it doesn't count.
    const [versioned, setVersioned] = useState({
        data: shownData,
        version: shownData === undefined ? 0 : 1,
    });
    if (shownData !== undefined && shownData !== versioned.data) {
        setVersioned({ data: shownData, version: versioned.version + 1 });
    }

    return {
        data: shownData ?? (keepPreviousData ? previousData : undefined),
        dataUpdatedAt: result.dataUpdatedAt,
        /** The data shown is the previous key's, while this key loads */
        isPreviousData:
            shownData === undefined &&
            keepPreviousData &&
            previousData !== undefined,
        version: versioned.version,
        error: result.error,
        isError: result.isError,
        refetch: result.refetch,
    };
};
