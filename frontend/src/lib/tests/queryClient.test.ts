import { useQuery } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearQueryCache, toQueryOptions } from "@/lib/queryCache";
import { QueryWrapper } from "@/test/queryClient";

const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
};

describe("useQuery with the app's query client", () => {
    beforeEach(() => clearQueryCache());

    it("shows the newest key's data when an older response arrives last", async () => {
        const round1 = deferred<string[]>();
        const round2 = deferred<string[]>();
        const queries: Record<string, () => Promise<string[]>> = {
            "result/round/1": () => round1.promise,
            "result/round/2": () => round2.promise,
        };
        const { result, rerender } = renderHook(
            ({ key }) => useQuery(toQueryOptions({ key, fetch: queries[key] })),
            {
                wrapper: QueryWrapper,
                initialProps: { key: "result/round/1" },
            }
        );

        rerender({ key: "result/round/2" });
        await act(async () => round2.resolve(["round 2"]));
        await act(async () => round1.resolve(["round 1"]));

        await waitFor(() => expect(result.current.data).toEqual(["round 2"]));
    });

    it("keeps the data on screen when a refetch fails", async () => {
        let fail = false;
        const fetch = () =>
            fail
                ? Promise.reject(new Error("offline"))
                : Promise.resolve(["a"]);
        // Read the fields during render, as a page does, so changes to them
        // re-render the hook
        const { result } = renderHook(
            () => {
                const { data, isError, refetch } = useQuery(
                    toQueryOptions({ key: "items", fetch })
                );
                return { data, isError, refetch };
            },
            { wrapper: QueryWrapper }
        );
        await waitFor(() => expect(result.current.data).toEqual(["a"]));

        fail = true;
        await act(async () => {
            await result.current.refetch();
        });

        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(result.current.data).toEqual(["a"]);
    });

    it("shares rooms between components and pages for a while", async () => {
        const fetch = vi.fn().mockResolvedValue([{ id: "room-1" }]);
        const rooms = { key: "competition/rooms", fetch };
        const useRooms = () => useQuery(toQueryOptions(rooms));

        // Two components mounted together make one request
        const first = renderHook(useRooms, { wrapper: QueryWrapper });
        const second = renderHook(useRooms, { wrapper: QueryWrapper });
        await waitFor(() => expect(first.result.current.data).toBeTruthy());
        expect(second.result.current.data).toEqual([{ id: "room-1" }]);
        expect(fetch).toHaveBeenCalledTimes(1);

        // Moving to another page that needs them soon after reuses them
        first.unmount();
        second.unmount();
        const next = renderHook(useRooms, { wrapper: QueryWrapper });
        expect(next.result.current.data).toEqual([{ id: "room-1" }]);
        expect(fetch).toHaveBeenCalledTimes(1);
    });
});
