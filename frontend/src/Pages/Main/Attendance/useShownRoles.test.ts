import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ATTENDANCE_ROLES_STORAGE_KEY, useShownRoles } from "./useShownRoles";

const ROLES = ["COMPETITOR", "SCRAMBLER", "RUNNER", "JUDGE"] as const;

describe("useShownRoles", () => {
    beforeEach(() => localStorage.clear());

    it("shows every role by default", () => {
        const { result } = renderHook(() => useShownRoles(ROLES));
        expect(result.current.shown).toEqual([...ROLES]);
    });

    it("hides and shows roles, keeping their order, and remembers it", () => {
        const { result, unmount } = renderHook(() => useShownRoles(ROLES));
        act(() => result.current.toggle("SCRAMBLER"));
        act(() => result.current.toggle("RUNNER"));
        expect(result.current.shown).toEqual(["COMPETITOR", "JUDGE"]);
        act(() => result.current.toggle("RUNNER"));
        expect(result.current.shown).toEqual(["COMPETITOR", "RUNNER", "JUDGE"]);
        unmount();

        const { result: again } = renderHook(() => useShownRoles(ROLES));
        expect(again.current.shown).toEqual(["COMPETITOR", "RUNNER", "JUDGE"]);
    });

    it("never hides the last role", () => {
        localStorage.setItem(
            ATTENDANCE_ROLES_STORAGE_KEY,
            JSON.stringify(["JUDGE"])
        );
        const { result } = renderHook(() => useShownRoles(ROLES));
        act(() => result.current.toggle("JUDGE"));
        expect(result.current.shown).toEqual(["JUDGE"]);
    });

    it("ignores a broken saved value", () => {
        localStorage.setItem(ATTENDANCE_ROLES_STORAGE_KEY, "{not json");
        const { result } = renderHook(() => useShownRoles(ROLES));
        expect(result.current.shown).toEqual([...ROLES]);
    });
});
