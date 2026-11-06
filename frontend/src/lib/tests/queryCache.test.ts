import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    clearQueryCache,
    fetchQuery,
    getQueryData,
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
        expect(getQueryData("items")).toEqual(["new"]);
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

        expect(getQueryData("items")).toEqual(["saved"]);
    });
});
