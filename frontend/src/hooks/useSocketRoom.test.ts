import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearQueryCache } from "@/lib/queryCache";
import { queryClient } from "@/lib/queryClient";
import { QueryWrapper } from "@/test/queryClient";

import { useSocketRoom } from "./useSocketRoom";

const fake = vi.hoisted(() => ({
    connected: true,
    handlers: new Map<string, Set<() => void>>(),
    emitted: [] as [string, unknown][],
}));

vi.mock("@/socket", () => ({
    socket: {
        get connected() {
            return fake.connected;
        },
        on: (event: string, handler: () => void) => {
            const set = fake.handlers.get(event) ?? new Set();
            set.add(handler);
            fake.handlers.set(event, set);
        },
        off: (event: string, handler: () => void) =>
            fake.handlers.get(event)?.delete(handler),
        emit: (event: string, payload: unknown) =>
            fake.emitted.push([event, payload]),
    },
}));

const fire = (event: string) =>
    act(() => fake.handlers.get(event)?.forEach((handler) => handler()));
const listenerCount = () =>
    [...fake.handlers.values()].reduce((sum, set) => sum + set.size, 0);

describe("useSocketRoom", () => {
    beforeEach(() => {
        clearQueryCache();
        fake.connected = true;
        fake.handlers.clear();
        fake.emitted = [];
    });
    afterEach(() => vi.restoreAllMocks());

    it("joins, joins again on reconnect and leaves on unmount", () => {
        const { unmount } = renderHook(
            () => useSocketRoom("Results", { params: { roundId: "333-r1" } }),
            { wrapper: QueryWrapper }
        );
        fire("connect");
        unmount();

        expect(fake.emitted).toEqual([
            ["joinResults", { roundId: "333-r1" }],
            ["joinResults", { roundId: "333-r1" }],
            ["leaveResults", { roundId: "333-r1" }],
        ]);
        expect(listenerCount()).toBe(0);
    });

    it("waits for the connection instead of joining twice", () => {
        fake.connected = false;
        renderHook(() => useSocketRoom("Devices"), { wrapper: QueryWrapper });
        expect(fake.emitted).toEqual([]);

        fire("connect");

        expect(fake.emitted).toEqual([["joinDevices", undefined]]);
    });

    it("refetches the named query when its event arrives", () => {
        const invalidate = vi.spyOn(queryClient, "invalidateQueries");
        renderHook(
            () =>
                useSocketRoom("Devices", {
                    invalidateOn: { deviceUpdated: ["device"] },
                }),
            { wrapper: QueryWrapper }
        );

        fire("deviceUpdated");

        expect(invalidate).toHaveBeenCalledWith({ queryKey: ["device"] });
    });

    it("stays in the room when re-rendered with equal options", () => {
        const { rerender } = renderHook(
            () => useSocketRoom("Results", { params: { roundId: "333-r1" } }),
            { wrapper: QueryWrapper }
        );

        rerender();

        expect(fake.emitted.map(([event]) => event)).toEqual(["joinResults"]);
    });

    it("joins nothing without a room", () => {
        renderHook(() => useSocketRoom(null), { wrapper: QueryWrapper });

        expect(fake.emitted).toEqual([]);
        expect(listenerCount()).toBe(0);
    });
});
