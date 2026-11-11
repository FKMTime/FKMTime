import { LucideIcon, Radio, Timer } from "lucide-react";

import { activityCodeToName } from "@/lib/activities";

export interface PublicOutletContext {
    /** Rounds with a group in progress; null until the rooms load */
    liveRoundIds: string[] | null;
}

export interface PublicNavItem {
    id: "live" | "results";
    label: string;
    icon: LucideIcon;
    to: string;
}

export const PUBLIC_NAV_ITEMS: PublicNavItem[] = [
    { id: "live", label: "Live solving", icon: Radio, to: "/public/live" },
    { id: "results", label: "Results", icon: Timer, to: "/public/results" },
];

export const isPublicResultsPath = (pathname: string) =>
    pathname.startsWith("/public/results");

/** Live solving is the default route, so anything but results is live */
export const getActivePublicNavId = (pathname: string): PublicNavItem["id"] =>
    isPublicResultsPath(pathname) ? "results" : "live";

/** "333-r1" → "3x3 R1" */
export const getShortRoundLabel = (roundId: string) =>
    activityCodeToName(roundId, true, true).replace(", ", " ");
