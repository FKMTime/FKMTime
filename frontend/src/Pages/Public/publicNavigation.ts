import { LucideIcon, Radio, Timer, Trophy } from "lucide-react";
import { Competition as WCIF } from "wcif-helpers";

import { activityCodeToName } from "@/lib/activities";
import { publicH2hPath } from "@/lib/h2hPublic";

export interface PublicOutletContext {
    /** Rounds with a group in progress; null until the rooms load */
    liveRoundIds: string[] | null;
}

export interface PublicNavItem {
    /** "live", "results", or "h2h-<roundId>" for a round's bracket */
    id: string;
    label: string;
    icon: LucideIcon;
    to: string;
}

export const PUBLIC_NAV_ITEMS: PublicNavItem[] = [
    { id: "live", label: "Live solving", icon: Radio, to: "/public/live" },
    { id: "results", label: "Results", icon: Timer, to: "/public/results" },
];

/** The competition's head-to-head rounds, which get a bracket page */
export const getH2hRoundIds = (wcif: WCIF | undefined) =>
    (wcif?.events ?? [])
        .flatMap((event) => event.rounds)
        .filter((round) => round.format === "h")
        .map((round) => round.id);

/** "333-r1" → "3x3 R1" */
export const getShortRoundLabel = (roundId: string) =>
    activityCodeToName(roundId, true, true).replace(", ", " ");

/**
 * Live solving, Results, then a Bracket item for each head-to-head round,
 * named after its round when there's more than one
 */
export const getPublicNavItems = (h2hRoundIds: string[]): PublicNavItem[] => [
    ...PUBLIC_NAV_ITEMS,
    ...h2hRoundIds.map((roundId) => ({
        id: `h2h-${roundId}`,
        label:
            h2hRoundIds.length === 1
                ? "Bracket"
                : `${getShortRoundLabel(roundId)} bracket`,
        icon: Trophy,
        to: publicH2hPath(roundId),
    })),
];

/**
 * The page's name for the header and the tab title. A bracket is named
 * before the competition loads, which is what lists the bracket items.
 */
export const getPublicTitle = (pathname: string, h2hRoundIds: string[]) => {
    const activeId = getActivePublicNavId(pathname);
    const item = getPublicNavItems(h2hRoundIds).find((i) => i.id === activeId);
    if (item) return item.label;
    return activeId.startsWith("h2h-") ? "Bracket" : "Live solving";
};

export const isPublicResultsPath = (pathname: string) =>
    pathname.startsWith("/public/results");

/** Live solving is the default route, so anything else is live */
export const getActivePublicNavId = (pathname: string): string => {
    const bracket = /^\/public\/h2h\/([^/]+)/.exec(pathname);
    if (bracket) return `h2h-${bracket[1]}`;
    return isPublicResultsPath(pathname) ? "results" : "live";
};
