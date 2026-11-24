import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useThrottledCallback } from "./useThrottledCallback";

describe("useThrottledCallback", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("runs the first call at once and merges a burst into one more run", () => {
        const callback = vi.fn();
        const { result } = renderHook(() =>
            useThrottledCallback(callback, 1000)
        );

        result.current();
        expect(callback).toHaveBeenCalledTimes(1);

        for (let i = 0; i < 10; i++) {
            result.current();
            act(() => vi.advanceTimersByTime(50));
        }
        expect(callback).toHaveBeenCalledTimes(1);

        act(() => vi.advanceTimersByTime(500));
        expect(callback).toHaveBeenCalledTimes(2);

        // Nothing more came in: the interval ends without another run
        act(() => vi.advanceTimersByTime(5000));
        expect(callback).toHaveBeenCalledTimes(2);

        // A quiet spell over, the next call runs at once again
        result.current();
        expect(callback).toHaveBeenCalledTimes(3);
    });

    it("keeps a steady stream to one run per interval", () => {
        const callback = vi.fn();
        const { result } = renderHook(() =>
            useThrottledCallback(callback, 1000)
        );

        // A call every 100 ms for ten seconds
        for (let i = 0; i < 100; i++) {
            result.current();
            act(() => vi.advanceTimersByTime(100));
        }
        // At once, then at the end of each of the ten intervals
        expect(callback).toHaveBeenCalledTimes(11);
    });

    it("runs nothing after the component is gone", () => {
        const callback = vi.fn();
        const { result, unmount } = renderHook(() =>
            useThrottledCallback(callback, 1000)
        );
        result.current();
        result.current();
        unmount();

        act(() => vi.advanceTimersByTime(5000));
        expect(callback).toHaveBeenCalledTimes(1);
    });
});
