import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDeferredDelete } from "./useDeferredDelete";

const showUndo = vi.fn();
const toast = vi.fn();
vi.mock("./useUndoToast", () => ({
    UNDO_WINDOW_MS: 8000,
    useUndoToast: () => showUndo,
}));
vi.mock("./useToast", () => ({ useToast: () => ({ toast }) }));

describe("useDeferredDelete", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
    });
    afterEach(() => vi.useRealTimers());

    it("hides at once and deletes only when the undo window closes", async () => {
        const remove = vi.fn(() => Promise.resolve(204));
        const onDeleted = vi.fn();
        const { result } = renderHook(() =>
            useDeferredDelete({ remove, onDeleted })
        );
        act(() => result.current.deleteLater("w1", "Warning deleted"));
        expect(result.current.isPending("w1")).toBe(true);
        expect(remove).not.toHaveBeenCalled();

        await act(() => vi.advanceTimersByTimeAsync(8000));
        expect(remove).toHaveBeenCalledWith("w1");
        expect(onDeleted).toHaveBeenCalledOnce();
        expect(result.current.isPending("w1")).toBe(false);
    });

    it("Undo shows it again and never deletes", async () => {
        const remove = vi.fn(() => Promise.resolve(204));
        const { result } = renderHook(() => useDeferredDelete({ remove }));
        act(() => result.current.deleteLater("w1", "Warning deleted"));
        act(() => showUndo.mock.calls[0][0].onUndo());
        expect(result.current.isPending("w1")).toBe(false);
        await act(() => vi.advanceTimersByTimeAsync(10000));
        expect(remove).not.toHaveBeenCalled();
    });

    it("brings the item back and says so when the delete fails", async () => {
        const remove = vi.fn(() => Promise.resolve(500));
        const { result } = renderHook(() => useDeferredDelete({ remove }));
        act(() => result.current.deleteLater("w1", "Warning deleted"));
        await act(() => vi.advanceTimersByTimeAsync(8000));
        expect(result.current.isPending("w1")).toBe(false);
        expect(toast).toHaveBeenCalledWith(
            expect.objectContaining({ title: "Could not delete" })
        );
    });

    it("deletes pending items right away when the page is left", () => {
        const remove = vi.fn(() => Promise.resolve(204));
        const { result, unmount } = renderHook(() =>
            useDeferredDelete({ remove })
        );
        act(() => result.current.deleteLater("w1", "Warning deleted"));
        unmount();
        expect(remove).toHaveBeenCalledWith("w1");
    });
});
