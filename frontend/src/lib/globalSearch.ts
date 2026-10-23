import { Competition as WCIF } from "wcif-helpers";

import { activityCodeToName } from "./activities";
import { Device, Incident, Person } from "./interfaces";
import { NavId, NavItem } from "./navigation";

export type SearchSection =
    | "Pages"
    | "Rounds"
    | "Groups"
    | "Competitors"
    | "Devices"
    | "Incidents";

/** Display order of the sections in the results */
export const SEARCH_SECTIONS: SearchSection[] = [
    "Pages",
    "Competitors",
    "Rounds",
    "Groups",
    "Incidents",
    "Devices",
];

export const SECTION_LIMIT = 5;

export interface SearchItem {
    id: string;
    section: SearchSection;
    label: string;
    description?: string;
    to: string;
    /** Extra text that matches but isn't shown, e.g. "333-r1-g2" */
    keywords?: string;
}

export interface SearchContext {
    useFkmTimeDevices: boolean;
}

interface SubPage {
    parent: NavId;
    label: string;
    to: string;
    needsDevices?: boolean;
    /** Only when the parent nav item points at this path */
    whenParentTo?: string;
}

// Tabs inside the nav sections, so "Most missed" or "Users" can be found
const SUB_PAGES: SubPage[] = [
    {
        parent: "incidents",
        label: "Open incidents",
        to: "/incidents",
        needsDevices: true,
    },
    {
        parent: "incidents",
        label: "Resolved incidents",
        to: "/incidents/resolved",
        needsDevices: true,
    },
    {
        parent: "incidents",
        label: "Noteworthy incidents",
        to: "/incidents/noteworthy",
        needsDevices: true,
    },
    { parent: "incidents", label: "Warnings", to: "/incidents/warnings" },
    { parent: "incidents", label: "Manual incidents", to: "/incidents/manual" },
    {
        parent: "persons",
        label: "Assign cards",
        to: "/cards",
        needsDevices: true,
    },
    { parent: "attendance", label: "Most missed", to: "/attendance/missed" },
    {
        parent: "attendance",
        label: "Attendance statistics",
        to: "/attendance/statistics",
    },
    {
        parent: "results",
        label: "Results checks",
        to: "/results/checks",
        whenParentTo: "/results",
    },
    { parent: "setup", label: "Current groups", to: "/competition/groups" },
    {
        parent: "setup",
        label: "Unofficial events",
        to: "/events",
        needsDevices: true,
    },
    { parent: "setup", label: "Devices", to: "/devices", needsDevices: true },
    { parent: "setup", label: "Users", to: "/users" },
    {
        parent: "scrambles",
        label: "Import scrambles",
        to: "/scrambles?tab=importScrambles",
    },
    {
        parent: "scrambles",
        label: "Scrambling devices",
        to: "/scrambles?tab=scramblingDevices",
    },
];

/** Nav items and their tabs the user can open, plus the public screens */
export const getPageItems = (
    navItems: NavItem[],
    ctx: SearchContext
): SearchItem[] => {
    const byId = new Map(navItems.map((item) => [item.id, item]));
    const sections = navItems.map((item) => ({
        id: `page:${item.id}`,
        section: "Pages" as const,
        label: item.label,
        to: item.to,
    }));
    const tabs = SUB_PAGES.filter((page) => {
        const parent = byId.get(page.parent);
        if (!parent) return false;
        if (page.needsDevices && !ctx.useFkmTimeDevices) return false;
        return !page.whenParentTo || parent.to === page.whenParentTo;
    }).map((page) => ({
        id: `page:${page.to}`,
        section: "Pages" as const,
        label: page.label,
        description: byId.get(page.parent)!.label,
        to: page.to,
    }));
    const publicScreens: SearchItem[] = [
        {
            id: "page:/public",
            section: "Pages",
            label: "Public display",
            description: "Live solving and results for competitors",
            to: "/public",
        },
        {
            id: "page:/public/tv",
            section: "Pages",
            label: "TV view",
            description: "Fullscreen view for venue screens",
            to: "/public/tv",
        },
    ];
    return [...sections, ...tabs, ...publicScreens];
};

/** Every round, opening its results; needs the Results section */
export const getRoundItems = (
    wcif: WCIF,
    navItems: NavItem[]
): SearchItem[] => {
    const results = navItems.find((item) => item.id === "results");
    if (!results) return [];
    const isPublicOnly = results.to !== "/results";
    return wcif.events.flatMap((event) =>
        event.rounds.map((round) => ({
            id: `round:${round.id}`,
            section: "Rounds" as const,
            label: activityCodeToName(round.id),
            description: "Results",
            to: isPublicOnly
                ? `/results/public/${round.id}`
                : `/results/round/${round.id}`,
            keywords: round.id,
        }))
    );
};

/** Every group in the schedule, opening its attendance */
export const getGroupItems = (
    wcif: WCIF,
    navItems: NavItem[]
): SearchItem[] => {
    if (!navItems.some((item) => item.id === "attendance")) return [];
    const codes = new Set<string>();
    wcif.schedule.venues.forEach((venue) =>
        venue.rooms.forEach((room) =>
            room.activities.forEach((activity) =>
                activity.childActivities.forEach((child) => {
                    if (child.activityCode.includes("-g"))
                        codes.add(child.activityCode);
                })
            )
        )
    );
    return [...codes].sort().map((code) => ({
        id: `group:${code}`,
        section: "Groups" as const,
        label: activityCodeToName(code),
        description: "Attendance",
        to: `/attendance/${code}`,
        keywords: code,
    }));
};

export const personToItem = (person: Person): SearchItem => ({
    id: `person:${person.id}`,
    section: "Competitors",
    label: person.name,
    description: [
        person.registrantId && `ID ${person.registrantId}`,
        person.wcaId ?? "Newcomer",
    ]
        .filter(Boolean)
        .join(" · "),
    to: `/persons/${person.id}/results`,
});

export const deviceToItem = (device: Device): SearchItem => ({
    id: `device:${device.id}`,
    section: "Devices",
    label: device.name,
    description: `ESP ID ${device.espId}`,
    to: "/devices",
    keywords: String(device.espId),
});

export const incidentToItem = (incident: Incident): SearchItem => ({
    id: `incident:${incident.id}`,
    section: "Incidents",
    label: incident.result.person.name,
    description: `${activityCodeToName(incident.result.roundId)} · Attempt ${incident.attemptNumber}`,
    to: `/incidents/${incident.id}`,
    keywords: incident.result.roundId,
});

/** Every word of the query appears in the label, description or keywords */
export const matchesQuery = (item: SearchItem, query: string) => {
    const haystack = [item.label, item.description, item.keywords]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    return query
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .every((word) => haystack.includes(word));
};

/**
 * Matching items grouped by section in display order, labels starting with
 * the query first, at most SECTION_LIMIT per section. preMatched items were
 * already matched elsewhere (e.g. competitors by the server) and are kept.
 */
export const searchItems = (
    items: SearchItem[],
    query: string,
    preMatched: SearchItem[] = []
) => {
    const lower = query.trim().toLowerCase();
    const matches = [
        ...items.filter((item) => matchesQuery(item, lower)),
        ...preMatched,
    ];
    return SEARCH_SECTIONS.map((section) => ({
        section,
        items: matches
            .filter((item) => item.section === section)
            .map((item, index) => ({
                item,
                index,
                isPrefix: item.label.toLowerCase().startsWith(lower),
            }))
            .sort(
                (a, b) =>
                    Number(b.isPrefix) - Number(a.isPrefix) || a.index - b.index
            )
            .slice(0, SECTION_LIMIT)
            .map(({ item }) => item),
    })).filter((group) => group.items.length > 0);
};
