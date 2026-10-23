import { describe, expect, it } from "vitest";
import { Competition as WCIF } from "wcif-helpers";

import {
    getGroupItems,
    getPageItems,
    getRoundItems,
    personToItem,
    searchItems,
} from "@/lib/globalSearch";
import { Person } from "@/lib/interfaces";
import { getNavItems, NavContext } from "@/lib/navigation";

const navFor = (overrides: Partial<NavContext> = {}) =>
    getNavItems({
        useFkmTimeDevices: true,
        isDelegate: true,
        isOrganizerOrDelegate: true,
        isStageLeaderOrAbove: true,
        canAccessSettings: true,
        ...overrides,
    });

const wcif = {
    events: [{ id: "333", rounds: [{ id: "333-r1" }, { id: "333-r2" }] }],
    schedule: {
        venues: [
            {
                rooms: [
                    {
                        activities: [
                            {
                                activityCode: "333-r1",
                                childActivities: [
                                    { activityCode: "333-r1-g1" },
                                    { activityCode: "333-r1-g2" },
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    },
} as unknown as WCIF;

const labels = (sections: ReturnType<typeof searchItems>) =>
    sections.flatMap((group) => group.items.map((item) => item.label));

describe("getPageItems", () => {
    it("finds tabs inside sections, with the section as description", () => {
        const items = getPageItems(navFor(), { useFkmTimeDevices: true });
        const [result] = searchItems(items, "most missed");
        expect(result.items[0]).toMatchObject({
            label: "Most missed",
            description: "Attendance",
            to: "/attendance/missed",
        });
    });

    it("leaves out sections and tabs the user can't open", () => {
        const items = getPageItems(
            navFor({
                isDelegate: false,
                isOrganizerOrDelegate: false,
                isStageLeaderOrAbove: false,
            }),
            { useFkmTimeDevices: true }
        );
        const found = items.map((item) => item.label);
        expect(found).toContain("Assign cards");
        expect(found).not.toContain("Incidents");
        expect(found).not.toContain("Most missed");
        expect(found).not.toContain("Users");
        expect(found).not.toContain("Results checks");
    });

    it("leaves out device-only tabs when FKMTime devices aren't used", () => {
        const items = getPageItems(navFor({ useFkmTimeDevices: false }), {
            useFkmTimeDevices: false,
        });
        const found = items.map((item) => item.label);
        expect(found).not.toContain("Assign cards");
        expect(found).not.toContain("Devices");
        expect(found).toContain("Manual incidents");
    });
});

describe("rounds and groups", () => {
    it("opens a round's results, by name or round code", () => {
        const items = getRoundItems(wcif, navFor());
        expect(labels(searchItems(items, "333-r2"))).toHaveLength(1);
        expect(searchItems(items, "round 2")[0].items[0].to).toBe(
            "/results/round/333-r2"
        );
    });

    it("sends staff without the delegate view to the public results", () => {
        const items = getRoundItems(wcif, navFor({ isDelegate: false }));
        expect(items[0].to).toBe("/results/public/333-r1");
    });

    it("opens a group's attendance, matching words in any order", () => {
        const items = getGroupItems(wcif, navFor());
        const [groups] = searchItems(items, "g2 333");
        expect(groups.items.map((item) => item.to)).toEqual([
            "/attendance/333-r1-g2",
        ]);
        expect(
            getGroupItems(wcif, navFor({ isStageLeaderOrAbove: false }))
        ).toEqual([]);
    });
});

describe("searchItems", () => {
    it("groups by section in display order, prefix matches first", () => {
        const items = [
            ...getPageItems(navFor(), { useFkmTimeDevices: true }),
            personToItem({
                id: "p1",
                name: "Theresa Example",
                registrantId: 4,
            } as Person),
        ];
        const sections = searchItems(items, "res");
        expect(sections.map((group) => group.section)).toEqual([
            "Pages",
            "Competitors",
        ]);
        expect(sections[0].items[0].label).toBe("Results");
    });

    it("finds nothing for unrelated text", () => {
        expect(
            searchItems(
                getPageItems(navFor(), { useFkmTimeDevices: true }),
                "zzz"
            )
        ).toEqual([]);
    });
});
