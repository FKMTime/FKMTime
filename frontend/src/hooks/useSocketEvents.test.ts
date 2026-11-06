import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSocketEvents } from "./useSocketEvents";

const handlers = vi.hoisted(() => new Map<string, Set<() => void>>());

vi.mock("@/socket", () => ({
    socket: {
        on: (event: string, handler: () => void) => {
            const set = handlers.get(event) ?? new Set();
            set.add(handler);
            handlers.set(event, set);
        },
        off: (event: string, handler: () => void) =>
            handlers.get(event)?.delete(handler),
    },
}));

const fire = (event: string) =>
    act(() => handlers.get(event)?.forEach((handler) => handler()));
const listenerCount = () =>
    [...handlers.values()].reduce((sum, set) => sum + set.size, 0);

describe("useSocketEvents", () => {
    beforeEach(() => handlers.clear());

    it("calls the latest handler without resubscribing", () => {
        const first = vi.fn();
        const second = vi.fn();
        const { rerender } = renderHook(
            ({ onIncident }) => useSocketEvents({ newIncident: onIncident }),
            { initialProps: { onIncident: first } }
        );

        rerender({ onIncident: second });
        fire("newIncident");

        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
        expect(listenerCount()).toBe(1);
    });

    it("removes its listeners on unmount", () => {
        const { unmount } = renderHook(() =>
            useSocketEvents({ newIncident: vi.fn(), attemptUpdated: vi.fn() })
        );
        expect(listenerCount()).toBe(2);

        unmount();

        expect(listenerCount()).toBe(0);
    });
});
