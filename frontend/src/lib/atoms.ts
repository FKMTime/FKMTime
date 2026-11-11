import { atom } from "jotai";

import { Competition } from "./interfaces";
import { Crumb } from "./navigation";

const competitionAtom = atom<Competition | null>(null);

const unresolvedIncidentsCountAtom = atom<number>(0);

export interface PageHeader {
    /** Desktop breadcrumbs; the last one is the page heading */
    crumbs?: Crumb[];
    /** Mobile header title and subtitle */
    title?: string;
    subtitle?: string;
    /** Mobile back target; null hides the back button */
    backTo?: string | null;
}

/** Set by pages through usePageHeader; null falls back to the nav defaults */
const pageHeaderAtom = atom<PageHeader | null>(null);

export interface QuickEntryState {
    isOpen: boolean;
    /** Preselected round; otherwise the current rounds are offered */
    roundId?: string;
}

const quickEntryAtom = atom<QuickEntryState>({ isOpen: false });

export {
    competitionAtom,
    pageHeaderAtom,
    quickEntryAtom,
    unresolvedIncidentsCountAtom,
};
