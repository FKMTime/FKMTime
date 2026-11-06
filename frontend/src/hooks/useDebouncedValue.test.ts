import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDebouncedValue } from "./useDebouncedValue";

describe("useDebouncedValue", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("returns the first value at once and later ones after the delay", () => {
        const { result, rerender } = renderHook(
            ({ value }) => useDebouncedValue(value, 250),
            { initialProps: { value: "a" } }
        );
        expect(result.current).toBe("a");

        rerender({ value: "ab" });
        act(() => vi.advanceTimersByTime(100));
        rerender({ value: "abc" });
        act(() => vi.advanceTimersByTime(249));
        expect(result.current).toBe("a");

        act(() => vi.advanceTimersByTime(1));
        expect(result.current).toBe("abc");
    });
});
