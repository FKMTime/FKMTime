import {
    ChartColumn,
    ClipboardList,
    House,
    LucideIcon,
    Radio,
    Settings,
    Shuffle,
    SlidersHorizontal,
    Timer,
    TriangleAlert,
    UserCheck,
    Users,
} from "lucide-react";
import { matchPath } from "react-router-dom";

export type NavId =
    | "home"
    | "incidents"
    | "persons"
    | "checkIn"
    | "attendance"
    | "results"
    | "live"
    | "setup"
    | "scrambles"
    | "statistics"
    | "settings";

export type NavGroup = "Competition day" | "Admin" | "Account";

export interface NavItem {
    id: NavId;
    label: string;
    icon: LucideIcon;
    to: string;
    group: NavGroup;
    /** Path prefixes that belong to this item; "/" only matches exactly */
    paths: string[];
}

export interface NavContext {
    useFkmTimeDevices: boolean;
    isDelegate: boolean;
    isOrganizerOrDelegate: boolean;
    isStageLeaderOrAbove: boolean;
    canAccessSettings: boolean;
}

export interface Crumb {
    label: string;
    to?: string;
}

/** Items shown as bottom tabs on mobile; everything else lives under More */
export const MOBILE_TAB_IDS: NavId[] = [
    "home",
    "incidents",
    "results",
    "persons",
];

export const MORE_PATH = "/more";

export const getNavItems = (ctx: NavContext): NavItem[] => {
    const items: (NavItem | false)[] = [
        {
            id: "home",
            label: "Home",
            icon: House,
            to: "/",
            group: "Competition day",
            paths: ["/"],
        },
        ctx.isDelegate && {
            id: "incidents",
            label: "Incidents",
            icon: TriangleAlert,
            to: ctx.useFkmTimeDevices ? "/incidents" : "/incidents/manual",
            group: "Competition day",
            paths: ["/incidents"],
        },
        {
            id: "persons",
            label: "Persons",
            icon: Users,
            to: "/persons",
            group: "Competition day",
            paths: ["/persons", "/cards"],
        },
        {
            id: "checkIn",
            label: "Check in",
            icon: UserCheck,
            to: "/check-in",
            group: "Competition day",
            paths: ["/check-in"],
        },
        ctx.isStageLeaderOrAbove && {
            id: "attendance",
            label: "Attendance",
            icon: ClipboardList,
            to: "/attendance",
            group: "Competition day",
            paths: ["/attendance"],
        },
        ctx.useFkmTimeDevices && {
            id: "results",
            label: "Results",
            icon: Timer,
            to: ctx.isDelegate ? "/results" : "/results/public",
            group: "Competition day",
            paths: ["/results"],
        },
        ctx.useFkmTimeDevices && {
            id: "live",
            label: "Live solving",
            icon: Radio,
            to: "/results/live",
            group: "Competition day",
            paths: ["/results/live"],
        },
        ctx.isOrganizerOrDelegate && {
            id: "setup",
            label: "Setup",
            icon: SlidersHorizontal,
            to: "/competition",
            group: "Admin",
            paths: ["/competition", "/devices", "/users", "/events"],
        },
        ctx.isDelegate &&
            ctx.useFkmTimeDevices && {
                id: "scrambles",
                label: "Scrambles",
                icon: Shuffle,
                to: "/scrambles",
                group: "Admin",
                paths: ["/scrambles"],
            },
        ctx.isOrganizerOrDelegate &&
            ctx.useFkmTimeDevices && {
                id: "statistics",
                label: "Statistics",
                icon: ChartColumn,
                to: "/statistics",
                group: "Admin",
                paths: ["/statistics"],
            },
        ctx.canAccessSettings && {
            id: "settings",
            label: "Settings",
            icon: Settings,
            to: "/settings",
            group: "Account",
            paths: ["/settings"],
        },
    ];
    return items.filter((item): item is NavItem => item !== false);
};

const matchLength = (pathname: string, prefix: string) => {
    if (prefix === "/") return pathname === "/" ? 1 : 0;
    return pathname === prefix || pathname.startsWith(`${prefix}/`)
        ? prefix.length
        : 0;
};

/** The item owning the path; the longest prefix wins (/results/live → Live solving) */
export const findActiveNavItem = (pathname: string, items: NavItem[]) => {
    let best: NavItem | undefined;
    let bestLength = 0;
    for (const item of items) {
        for (const prefix of item.paths) {
            const length = matchLength(pathname, prefix);
            if (length > bestLength) {
                best = item;
                bestLength = length;
            }
        }
    }
    return best;
};

const INCIDENT_TABS = ["resolved", "noteworthy", "warnings", "manual"];
const RESULTS_SECTIONS = ["round", "public", "live", "checks"];

/**
 * Pages below a section root. They get a back button on mobile and a
 * two-level breadcrumb on desktop.
 */
export const getDetailLabel = (pathname: string): string | null => {
    const incident = matchPath("/incidents/:id", pathname);
    if (incident && !INCIDENT_TABS.includes(incident.params.id!))
        return "Incident";
    if (matchPath("/persons/:id/results", pathname)) return "Results";
    if (matchPath("/results/round/:id/double-check", pathname))
        return "Double check";
    if (matchPath("/results/round/:id/enter-scorecard", pathname))
        return "Enter scorecard";
    if (
        matchPath("/results/public", pathname) ||
        matchPath("/results/public/:id", pathname)
    )
        return "Public view";
    const result = matchPath("/results/:id", pathname);
    if (result && !RESULTS_SECTIONS.includes(result.params.id!))
        return "Result";
    return null;
};

export const isMobileTab = (item?: NavItem) =>
    !!item && MOBILE_TAB_IDS.includes(item.id);

export const getDefaultCrumbs = (pathname: string, item?: NavItem): Crumb[] => {
    if (!item) return [];
    const detail = getDetailLabel(pathname);
    // Non-delegates land on the public view as their Results root
    if (!detail || pathname === item.to) return [{ label: item.label }];
    return [{ label: item.label, to: item.to }, { label: detail }];
};

/** Where the mobile header's back button goes, or null for no back button */
export const getMobileBackTarget = (
    pathname: string,
    item?: NavItem
): string | null => {
    if (pathname === MORE_PATH || !item) return null;
    if (getDetailLabel(pathname) && pathname !== item.to) return item.to;
    return isMobileTab(item) ? null : MORE_PATH;
};

/** "Day 1 · Saturday 18 April" while the competition runs, otherwise undefined */
export const getCompetitionDayLabel = (
    startDate: string,
    numberOfDays: number,
    today = new Date()
) => {
    // Parse as a local date; new Date("YYYY-MM-DD") would be UTC midnight
    const [year, month, day] = startDate.split("-").map(Number);
    const start = new Date(year, month - 1, day);
    const current = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
    );
    const dayIndex = Math.round(
        (current.getTime() - start.getTime()) / 86_400_000
    );
    if (dayIndex < 0 || dayIndex >= numberOfDays) return undefined;
    const date = current.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
    });
    return `Day ${dayIndex + 1} · ${date.replace(",", "")}`;
};
