import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { markAsPresent, restoreAttendance } from "@/lib/attendance";
import { StaffActivity, StaffActivityStatus } from "@/lib/interfaces";

import { useMarkAttendance } from "./useMarkAttendance";

const showUndo = vi.fn();
vi.mock("@/hooks/useUndoToast", () => ({ useUndoToast: () => showUndo }));
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/attendance", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/attendance")>()),
    markAsPresent: vi.fn(() => Promise.resolve(201)),
    markAsAbsent: vi.fn(() => Promise.resolve(201)),
    markAsLate: vi.fn(() => Promise.resolve(201)),
    restoreAttendance: vi.fn(() => Promise.resolve(200)),
}));

const attendance = [
    {
        id: "a1",
        status: StaffActivityStatus.ABSENT,
        leftEarly: false,
        noShow: true,
        replacedById: "p9",
        person: { name: "Ada Demo" },
    },
] as StaffActivity[];

const absentNotComing = {
    status: StaffActivityStatus.ABSENT,
    leftEarly: false,
    noShow: true,
    replacedById: "p9",
};

describe("useMarkAttendance", () => {
    beforeEach(() => vi.clearAllMocks());

    it("marks at once and Undo puts the previous status and tags back", async () => {
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
        expect(restoreAttendance).toHaveBeenCalledWith("a1", absentNotComing);
        expect(refresh).toHaveBeenCalledTimes(2);
    });

    it("runs any other change with the same Undo", async () => {
        const action = vi.fn(() => Promise.resolve(200));
        const { result } = renderHook(() =>
            useMarkAttendance(attendance, vi.fn())
        );
        await act(() => result.current.change("a1", action, "marked replaced"));
        expect(action).toHaveBeenCalledOnce();
        expect(showUndo).toHaveBeenCalledWith(
            expect.objectContaining({ title: "Ada Demo marked replaced" })
        );
        await act(() => showUndo.mock.calls[0][0].onUndo());
        expect(restoreAttendance).toHaveBeenCalledWith("a1", absentNotComing);
    });

    it("marks several at once with one Undo for all of them", async () => {
        const refresh = vi.fn();
        const two = [
            ...attendance,
            {
                id: "a2",
                status: StaffActivityStatus.LATE,
                leftEarly: true,
                noShow: false,
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
        expect(restoreAttendance).toHaveBeenCalledWith("a1", absentNotComing);
        expect(restoreAttendance).toHaveBeenCalledWith("a2", {
            status: StaffActivityStatus.LATE,
            leftEarly: true,
            noShow: false,
            replacedById: null,
        });
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
