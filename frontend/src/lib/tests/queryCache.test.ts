import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCachedQuery } from "@/hooks/useCachedQuery";
import {
    clearQueryCache,
    fetchQuery,
    getQueryEntry,
    prefetchQuery,
    Query,
    setQueryData,
} from "@/lib/queryCache";

const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
};

const query = (fetch: () => Promise<string[]>): Query<string[]> => ({
    key: "items",
    fetch,
});

describe("queryCache", () => {
    beforeEach(() => clearQueryCache());

    it("doesn't prefetch what is already cached", async () => {
        const fetch = vi.fn().mockResolvedValue(["a"]);
        await fetchQuery(query(fetch));

        prefetchQuery(query(fetch));

        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("keeps the newer response when an older one arrives last", async () => {
        const older = deferred<string[]>();
        const newer = deferred<string[]>();
        const fetch = vi
            .fn()
            .mockReturnValueOnce(older.promise)
            .mockReturnValueOnce(newer.promise);

        const first = fetchQuery(query(fetch));
        const second = fetchQuery(query(fetch));
        newer.resolve(["new"]);
        await second;
        older.resolve(["old"]);
        await first;

        expect(getQueryEntry("items")?.data).toEqual(["new"]);
    });

    it("ignores a response that started before a save", async () => {
        const request = deferred<string[]>();
        const pending = fetchQuery(query(() => request.promise));

        setQueryData("items", ["saved"]);
        request.resolve(["before save"]);
        await pending;

        expect(getQueryEntry("items")?.data).toEqual(["saved"]);
    });

    it("keeps the version when a refetch brings the same data", async () => {
        const fetch = vi.fn().mockResolvedValue(["a"]);
        await fetchQuery(query(fetch));
        await fetchQuery(query(fetch));

        expect(getQueryEntry("items")?.version).toBe(1);
    });
});

describe("useCachedQuery", () => {
    beforeEach(() => clearQueryCache());

    it("shows cached data on the first render and refreshes it", async () => {
        setQueryData("items", ["cached"]);
        const fresh = deferred<string[]>();
        const itemsQuery = query(() => fresh.promise);

        const { result } = renderHook(() => useCachedQuery(itemsQuery));

        expect(result.current.data).toEqual(["cached"]);
        await act(async () => fresh.resolve(["fresh"]));
        await waitFor(() => expect(result.current.data).toEqual(["fresh"]));
    });

    it("reuses a prefetch that is still loading", async () => {
        const fetch = vi.fn().mockResolvedValue(["a"]);
        const itemsQuery = query(fetch);
        prefetchQuery(itemsQuery);

        const { result } = renderHook(() => useCachedQuery(itemsQuery));

        await waitFor(() => expect(result.current.data).toEqual(["a"]));
        expect(fetch).toHaveBeenCalledTimes(1);
    });
});
