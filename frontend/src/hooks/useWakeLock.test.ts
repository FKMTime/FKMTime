import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWakeLock } from "./useWakeLock";

describe("useWakeLock", () => {
    const release = vi.fn(() => Promise.resolve());
    const request = vi.fn(() => Promise.resolve({ release }));

    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(navigator, "wakeLock", {
            value: { request },
            configurable: true,
        });
    });
    afterEach(() => {
        Reflect.deleteProperty(navigator, "wakeLock");
    });

    it("locks the screen and releases it on unmount", async () => {
        const { unmount } = renderHook(() => useWakeLock());
        await act(() => Promise.resolve());
        expect(request).toHaveBeenCalledWith("screen");

        unmount();
        expect(release).toHaveBeenCalledTimes(1);
    });

    it("locks again when the tab becomes visible", async () => {
        renderHook(() => useWakeLock());
        await act(async () => {
            document.dispatchEvent(new Event("visibilitychange"));
        });
        expect(request).toHaveBeenCalledTimes(2);
    });

    it("does nothing without the Wake Lock API", () => {
        Reflect.deleteProperty(navigator, "wakeLock");
        expect(() => renderHook(() => useWakeLock())).not.toThrow();
        expect(request).not.toHaveBeenCalled();
    });
});
