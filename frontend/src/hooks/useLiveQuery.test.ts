import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    clearQueryCache,
    LIVE_MAX_AGE,
    Query,
    setQueryData,
} from "@/lib/queryCache";
import { QueryWrapper } from "@/test/queryClient";

import { useLiveQuery } from "./useLiveQuery";

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

describe("useLiveQuery", () => {
    beforeEach(() => clearQueryCache());
    afterEach(() => vi.restoreAllMocks());

    it("hides data older than maxAge until the refresh arrives", async () => {
        setQueryData("items", ["old"]);
        advanceClock(LIVE_MAX_AGE + 1);
        const fresh = deferred<string[]>();
        const itemsQuery = query(() => fresh.promise);

        const { result } = renderHook(
            () => useLiveQuery(itemsQuery, { maxAge: LIVE_MAX_AGE }),
            { wrapper: QueryWrapper }
        );

        expect(result.current.data).toBeUndefined();
        await act(async () => fresh.resolve(["new"]));
        await waitFor(() => expect(result.current.data).toEqual(["new"]));
    });

    it("keeps old data hidden when the refresh fails", async () => {
        setQueryData("items", ["old"]);
        advanceClock(LIVE_MAX_AGE + 1);
        const itemsQuery = query(() => Promise.reject(new Error("offline")));

        const { result } = renderHook(
            () => useLiveQuery(itemsQuery, { maxAge: LIVE_MAX_AGE }),
            { wrapper: QueryWrapper }
        );

        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(result.current.data).toBeUndefined();
    });

    it("shows data within maxAge straight away", () => {
        setQueryData("items", ["recent"]);
        const itemsQuery = query(() => new Promise(() => {}));

        const { result } = renderHook(
            () => useLiveQuery(itemsQuery, { maxAge: LIVE_MAX_AGE }),
            { wrapper: QueryWrapper }
        );

        expect(result.current.data).toEqual(["recent"]);
    });

    it("keeps the previous key's data while a new key loads", async () => {
        const queries: Record<string, Query<string[]>> = {
            a: { key: "a", fetch: () => Promise.resolve(["from a"]) },
            b: { key: "b", fetch: () => new Promise(() => {}) },
        };
        const { result, rerender } = renderHook(
            ({ key }) => useLiveQuery(queries[key], { keepPreviousData: true }),
            { wrapper: QueryWrapper, initialProps: { key: "a" } }
        );
        await waitFor(() => expect(result.current.data).toEqual(["from a"]));

        rerender({ key: "b" });

        expect(result.current.data).toEqual(["from a"]);
    });

    it("shows cached data on the first render and refreshes it", async () => {
        setQueryData("items", ["cached"]);
        const fresh = deferred<string[]>();
        const itemsQuery = query(() => fresh.promise);

        const { result } = renderHook(() => useLiveQuery(itemsQuery), {
            wrapper: QueryWrapper,
        });

        expect(result.current.data).toEqual(["cached"]);
        await act(async () => fresh.resolve(["fresh"]));
        await waitFor(() => expect(result.current.data).toEqual(["fresh"]));
    });

    it("bumps the version only when the data changes", async () => {
        let response = ["a"];
        const itemsQuery = query(() => Promise.resolve([...response]));
        const { result } = renderHook(() => useLiveQuery(itemsQuery), {
            wrapper: QueryWrapper,
        });
        await waitFor(() => expect(result.current.version).toBe(1));

        await act(async () => {
            await result.current.refetch();
        });
        expect(result.current.version).toBe(1);

        response = ["b"];
        await act(async () => {
            await result.current.refetch();
        });
        await waitFor(() => expect(result.current.version).toBe(2));
    });

    it("fetches nothing when disabled", () => {
        const fetch = vi.fn().mockResolvedValue(["a"]);

        renderHook(() => useLiveQuery(query(fetch), { enabled: false }), {
            wrapper: QueryWrapper,
        });

        expect(fetch).not.toHaveBeenCalled();
    });
});
