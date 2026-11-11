import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useIsMobile } from "./useMobile";

const originalWidth = window.innerWidth;

const setWidth = (width: number) => {
    Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: width,
    });
};

describe("useIsMobile", () => {
    afterEach(() => {
        setWidth(originalWidth);
        vi.restoreAllMocks();
    });

    it("is correct on the first render", () => {
        setWidth(500);
        const renders: boolean[] = [];
        renderHook(() => {
            renders.push(useIsMobile());
        });
        expect(renders[0]).toBe(true);
    });

    it("updates when the media query changes", () => {
        const listeners = new Set<() => void>();
        vi.spyOn(window, "matchMedia").mockReturnValue({
            addEventListener: (_: string, listener: () => void) =>
                listeners.add(listener),
            removeEventListener: (_: string, listener: () => void) =>
                listeners.delete(listener),
        } as unknown as MediaQueryList);

        setWidth(1024);
        const { result, unmount } = renderHook(() => useIsMobile());
        expect(result.current).toBe(false);

        setWidth(500);
        act(() => listeners.forEach((listener) => listener()));
        expect(result.current).toBe(true);

        unmount();
        expect(listeners.size).toBe(0);
    });
});
