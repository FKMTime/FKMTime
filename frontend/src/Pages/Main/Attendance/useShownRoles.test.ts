import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ATTENDANCE_ROLES_STORAGE_KEY, useShownRoles } from "./useShownRoles";

const ROLES = ["COMPETITOR", "SCRAMBLER", "RUNNER", "JUDGE"] as const;
const GROUP = "333-r1-g1";

describe("useShownRoles", () => {
    beforeEach(() => localStorage.clear());

    it("shows every role by default", () => {
        const { result } = renderHook(() => useShownRoles(ROLES, GROUP, []));
        expect(result.current.shown).toEqual([...ROLES]);
    });

    it("hides and shows roles, keeping their order, and remembers it", () => {
        const { result, unmount } = renderHook(() =>
            useShownRoles(ROLES, GROUP, [])
        );
        act(() => result.current.toggle("SCRAMBLER"));
        act(() => result.current.toggle("RUNNER"));
        expect(result.current.shown).toEqual(["COMPETITOR", "JUDGE"]);
        act(() => result.current.toggle("RUNNER"));
        expect(result.current.shown).toEqual(["COMPETITOR", "RUNNER", "JUDGE"]);
        unmount();

        const { result: again } = renderHook(() =>
            useShownRoles(ROLES, GROUP, [])
        );
        expect(again.current.shown).toEqual(["COMPETITOR", "RUNNER", "JUDGE"]);
    });

    it("never hides the last role", () => {
        localStorage.setItem(
            ATTENDANCE_ROLES_STORAGE_KEY,
            JSON.stringify(["JUDGE"])
        );
        const { result } = renderHook(() => useShownRoles(ROLES, GROUP, []));
        act(() => result.current.toggle("JUDGE"));
        expect(result.current.shown).toEqual(["JUDGE"]);
    });

    it("hides a role nobody holds in the group", () => {
        const { result } = renderHook(() =>
            useShownRoles(ROLES, GROUP, ["RUNNER"])
        );
        expect(result.current.shown).toEqual([
            "COMPETITOR",
            "SCRAMBLER",
            "JUDGE",
        ]);
    });

    it("shows an empty role for the group once turned on", () => {
        const { result, rerender } = renderHook(
            ({ group }) => useShownRoles(ROLES, group, ["RUNNER"]),
            { initialProps: { group: GROUP } }
        );
        act(() => result.current.toggle("RUNNER"));
        expect(result.current.shown).toContain("RUNNER");

        rerender({ group: "333-r1-g2" });
        expect(result.current.shown).not.toContain("RUNNER");
    });

    it("keeps an empty role's saved choice when hiding it again", () => {
        const { result, rerender } = renderHook(
            ({ empty }: { empty: (typeof ROLES)[number][] }) =>
                useShownRoles(ROLES, GROUP, empty),
            { initialProps: { empty: ["RUNNER"] } }
        );
        act(() => result.current.toggle("RUNNER"));
        act(() => result.current.toggle("RUNNER"));
        rerender({ empty: [] });
        expect(result.current.shown).toEqual([...ROLES]);
    });

    it("shows saved roles when all of them are empty", () => {
        localStorage.setItem(
            ATTENDANCE_ROLES_STORAGE_KEY,
            JSON.stringify(["RUNNER"])
        );
        const { result } = renderHook(() =>
            useShownRoles(ROLES, GROUP, ["RUNNER"])
        );
        expect(result.current.shown).toEqual(["RUNNER"]);
    });

    it("ignores a broken saved value", () => {
        localStorage.setItem(ATTENDANCE_ROLES_STORAGE_KEY, "{not json");
        const { result } = renderHook(() => useShownRoles(ROLES, GROUP, []));
        expect(result.current.shown).toEqual([...ROLES]);
    });
});
