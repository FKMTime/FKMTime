import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { markAsAbsent, markAsLate, markAsPresent } from "@/lib/attendance";
import { StaffActivity, StaffActivityStatus } from "@/lib/interfaces";

import { useMarkAttendance } from "./useMarkAttendance";

const showUndo = vi.fn();
vi.mock("@/hooks/useUndoToast", () => ({ useUndoToast: () => showUndo }));
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/attendance", () => ({
    markAsPresent: vi.fn(() => Promise.resolve(201)),
    markAsAbsent: vi.fn(() => Promise.resolve(201)),
    markAsLate: vi.fn(() => Promise.resolve(201)),
    markAsPresentButReplaced: vi.fn(() => Promise.resolve(201)),
}));

const attendance = [
    {
        id: "a1",
        status: StaffActivityStatus.ABSENT,
        person: { name: "Ada Demo" },
    },
] as StaffActivity[];

describe("useMarkAttendance", () => {
    beforeEach(() => vi.clearAllMocks());

    it("marks at once and Undo puts the previous status back", async () => {
        const refresh = vi.fn();
        const { result } = renderHook(() =>
            useMarkAttendance(attendance, refresh)
        );
        await act(() =>
            result.current.markOne(StaffActivityStatus.PRESENT, "a1", "present")
        );
        expect(markAsPresent).toHaveBeenCalledWith("a1");
        expect(refresh).toHaveBeenCalledOnce();
        expect(showUndo).toHaveBeenCalledWith(
            expect.objectContaining({ title: "Ada Demo marked present" })
        );

        await act(() => showUndo.mock.calls[0][0].onUndo());
        expect(markAsAbsent).toHaveBeenCalledWith("a1");
        expect(refresh).toHaveBeenCalledTimes(2);
    });

    it("marks several at once with one Undo for all of them", async () => {
        const refresh = vi.fn();
        const two = [
            ...attendance,
            {
                id: "a2",
                status: StaffActivityStatus.LATE,
                person: { name: "Ben Test" },
            },
        ] as StaffActivity[];
        const { result } = renderHook(() => useMarkAttendance(two, refresh));
        await act(() =>
            result.current.markMany(
                StaffActivityStatus.PRESENT,
                ["a1", "a2"],
                "present"
            )
        );
        expect(markAsPresent).toHaveBeenCalledTimes(2);
        expect(showUndo).toHaveBeenCalledWith(
            expect.objectContaining({ title: "2 marked present" })
        );
        await act(() => showUndo.mock.calls[0][0].onUndo());
        expect(markAsAbsent).toHaveBeenCalledWith("a1");
        expect(markAsLate).toHaveBeenCalledWith("a2");
    });

    it("offers no Undo when it can't be put back", async () => {
        const { result } = renderHook(() =>
            useMarkAttendance(attendance, vi.fn())
        );
        await act(() =>
            result.current.markOne(StaffActivityStatus.ABSENT, "a1", "absent", {
                canUndo: false,
            })
        );
        expect(showUndo).not.toHaveBeenCalled();
    });
});
