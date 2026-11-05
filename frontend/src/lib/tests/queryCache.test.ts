import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCachedQuery } from "@/hooks/useCachedQuery";
import {
    clearQueryCache,
    fetchQuery,
    getQueryEntry,
    LIVE_MAX_AGE,
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

const advanceClock = (ms: number) => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + ms);
};

describe("queryCache", () => {
    beforeEach(() => clearQueryCache());
    afterEach(() => vi.restoreAllMocks());

    it("doesn't prefetch what is already cached", async () => {
        const fetch = vi.fn().mockResolvedValue(["a"]);
        await fetchQuery(query(fetch));

        prefetchQuery(query(fetch));

        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("prefetches again once the cached data is older than maxAge", async () => {
        const fetch = vi.fn().mockResolvedValue(["a"]);
        await fetchQuery(query(fetch));
        advanceClock(LIVE_MAX_AGE + 1);

        prefetchQuery(query(fetch), { maxAge: LIVE_MAX_AGE });

        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("keeps the newer response when an older one arrives last", async () => {
        setQueryData("items", ["cached"]);
        const older = deferred<string[]>();
        const newer = deferred<string[]>();
        const fetch = vi
            .fn()
            .mockReturnValueOnce(older.promise)
            .mockReturnValueOnce(newer.promise);

        const first = fetchQuery(query(fetch));
        const second = fetchQuery(query(fetch));
        newer.resolve(["new"]);
        older.resolve(["old"]);

        await expect(second).resolves.toEqual(["new"]);
        // The replaced call resolves with the newer data too
        await expect(first).resolves.toEqual(["new"]);
        expect(getQueryEntry("items")?.data).toEqual(["new"]);
    });

    it("shares the first load instead of starting a second", async () => {
        const fetch = vi.fn().mockResolvedValue(["a"]);

        const first = fetchQuery(query(fetch));
        const second = fetchQuery(query(fetch));

        await expect(second).resolves.toEqual(["a"]);
        await expect(first).resolves.toEqual(["a"]);
        expect(fetch).toHaveBeenCalledTimes(1);
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
    afterEach(() => vi.restoreAllMocks());

    it("hides data older than maxAge until the refresh arrives", async () => {
        setQueryData("items", ["old"]);
        advanceClock(LIVE_MAX_AGE + 1);
        const fresh = deferred<string[]>();
        const itemsQuery = query(() => fresh.promise);

        const { result } = renderHook(() =>
            useCachedQuery(itemsQuery, { maxAge: LIVE_MAX_AGE })
        );

        expect(result.current.data).toBeUndefined();
        await act(async () => fresh.resolve(["new"]));
        await waitFor(() => expect(result.current.data).toEqual(["new"]));
    });

    it("keeps old data hidden when the refresh fails", async () => {
        setQueryData("items", ["old"]);
        advanceClock(LIVE_MAX_AGE + 1);
        const itemsQuery = query(() => Promise.reject(new Error("offline")));

        const { result } = renderHook(() =>
            useCachedQuery(itemsQuery, { maxAge: LIVE_MAX_AGE })
        );

        await waitFor(() => expect(result.current.error).toBeTruthy());
        expect(result.current.data).toBeUndefined();
    });

    it("shows data within maxAge straight away", () => {
        setQueryData("items", ["recent"]);
        const itemsQuery = query(() => new Promise(() => {}));

        const { result } = renderHook(() =>
            useCachedQuery(itemsQuery, { maxAge: LIVE_MAX_AGE })
        );

        expect(result.current.data).toEqual(["recent"]);
    });

    it("keeps the previous key's data while a new key loads", async () => {
        const queries: Record<string, Query<string[]>> = {
            a: { key: "a", fetch: () => Promise.resolve(["from a"]) },
            b: { key: "b", fetch: () => new Promise(() => {}) },
        };
        const { result, rerender } = renderHook(
            ({ key }) =>
                useCachedQuery(queries[key], { keepPreviousData: true }),
            { initialProps: { key: "a" } }
        );
        await waitFor(() => expect(result.current.data).toEqual(["from a"]));

        rerender({ key: "b" });

        expect(result.current.data).toEqual(["from a"]);
    });

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
