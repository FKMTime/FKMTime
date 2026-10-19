import { describe, expect, it } from "vitest";

import {
    findActiveNavItem,
    getCompetitionDayLabel,
    getDefaultCrumbs,
    getDetailLabel,
    getMobileBackTarget,
    getNavItems,
    NavContext,
} from "@/lib/navigation";

const delegate: NavContext = {
    useFkmTimeDevices: true,
    isDelegate: true,
    isOrganizerOrDelegate: true,
    isStageLeaderOrAbove: true,
    canAccessSettings: true,
};

const staff: NavContext = {
    useFkmTimeDevices: true,
    isDelegate: false,
    isOrganizerOrDelegate: false,
    isStageLeaderOrAbove: false,
    canAccessSettings: false,
};

const ids = (ctx: NavContext) => getNavItems(ctx).map((item) => item.id);

describe("getNavItems", () => {
    it("shows every section to a delegate", () => {
        expect(ids(delegate)).toEqual([
            "home",
            "incidents",
            "persons",
            "checkIn",
            "attendance",
            "results",
            "live",
            "setup",
            "scrambles",
            "statistics",
            "settings",
        ]);
    });

    it("limits staff to the competition day basics", () => {
        expect(ids(staff)).toEqual([
            "home",
            "persons",
            "checkIn",
            "results",
            "live",
        ]);
    });

    it("sends non-delegates to the public results view", () => {
        const results = getNavItems(staff).find((i) => i.id === "results");
        expect(results?.to).toBe("/results/public");
    });

    it("hides device features and opens manual incidents without FKMTime devices", () => {
        const items = getNavItems({ ...delegate, useFkmTimeDevices: false });
        expect(items.map((i) => i.id)).not.toContain("results");
        expect(items.map((i) => i.id)).not.toContain("scrambles");
        expect(items.find((i) => i.id === "incidents")?.to).toBe(
            "/incidents/manual"
        );
    });
});

describe("findActiveNavItem", () => {
    const items = getNavItems(delegate);
    const active = (path: string) => findActiveNavItem(path, items)?.id;

    it("matches home only on the root path", () => {
        expect(active("/")).toBe("home");
        expect(active("/unknown")).toBeUndefined();
    });

    it("prefers the longest matching prefix", () => {
        expect(active("/results/live")).toBe("live");
        expect(active("/results/round/333-r1")).toBe("results");
    });

    it("groups setup routes and card assignment", () => {
        expect(active("/devices")).toBe("setup");
        expect(active("/users")).toBe("setup");
        expect(active("/cards")).toBe("persons");
    });

    it("does not match on a partial segment", () => {
        expect(active("/resultsx")).toBeUndefined();
    });
});

describe("getDetailLabel", () => {
    it("treats incident tabs as section roots", () => {
        expect(getDetailLabel("/incidents/resolved")).toBeNull();
        expect(getDetailLabel("/incidents/manual")).toBeNull();
        expect(getDetailLabel("/incidents/abc123")).toBe("Incident");
    });

    it("recognises result sub-pages", () => {
        expect(getDetailLabel("/results/round/333-r1")).toBeNull();
        expect(getDetailLabel("/results/checks")).toBeNull();
        expect(getDetailLabel("/results/round/333-r1/double-check")).toBe(
            "Double check"
        );
        expect(getDetailLabel("/results/abc123")).toBe("Result");
    });
});

describe("getDefaultCrumbs", () => {
    const items = getNavItems(delegate);
    const crumbs = (path: string) =>
        getDefaultCrumbs(path, findActiveNavItem(path, items));

    it("uses the section name on section roots", () => {
        expect(crumbs("/persons")).toEqual([{ label: "Persons" }]);
    });

    it("links back to the section from detail pages", () => {
        expect(crumbs("/persons/1/results")).toEqual([
            { label: "Persons", to: "/persons" },
            { label: "Results" },
        ]);
    });

    it("treats the public view as the root for non-delegates", () => {
        const staffItems = getNavItems(staff);
        expect(
            getDefaultCrumbs(
                "/results/public",
                findActiveNavItem("/results/public", staffItems)
            )
        ).toEqual([{ label: "Results" }]);
    });
});

describe("getMobileBackTarget", () => {
    const items = getNavItems(delegate);
    const back = (path: string) =>
        getMobileBackTarget(path, findActiveNavItem(path, items));

    it("has no back button on bottom tabs and More", () => {
        expect(back("/")).toBeNull();
        expect(back("/incidents/resolved")).toBeNull();
        expect(back("/more")).toBeNull();
    });

    it("returns to More from pages listed there", () => {
        expect(back("/check-in")).toBe("/more");
        expect(back("/devices")).toBe("/more");
    });

    it("returns to the section root from detail pages", () => {
        expect(back("/results/round/333-r1/enter-scorecard")).toBe("/results");
        expect(back("/incidents/abc123")).toBe("/incidents");
    });
});

describe("getCompetitionDayLabel", () => {
    it("labels each competition day", () => {
        expect(
            getCompetitionDayLabel("2026-04-18", 2, new Date(2026, 3, 18, 9))
        ).toBe("Day 1 · Saturday 18 April");
        expect(
            getCompetitionDayLabel("2026-04-18", 2, new Date(2026, 3, 19, 23))
        ).toBe("Day 2 · Sunday 19 April");
    });

    it("returns undefined outside the competition", () => {
        expect(
            getCompetitionDayLabel("2026-04-18", 2, new Date(2026, 3, 17))
        ).toBeUndefined();
        expect(
            getCompetitionDayLabel("2026-04-18", 2, new Date(2026, 3, 20))
        ).toBeUndefined();
    });
});
