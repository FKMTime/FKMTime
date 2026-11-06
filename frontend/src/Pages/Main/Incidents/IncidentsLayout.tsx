import { useAtom, useAtomValue } from "jotai";
import { useCallback, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";

import PageTabs, { PageTab } from "@/Components/shared/PageTabs";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { usePageHeader } from "@/hooks/usePageHeader";
import { useSocketEvents } from "@/hooks/useSocketEvents";
import { competitionAtom, unresolvedIncidentsCountAtom } from "@/lib/atoms";
import {
    getUnresolvedIncidentsCount,
    manualIncidentsQuery,
    noteworthyIncidentsQuery,
    resolvedIncidentsQuery,
    unresolvedIncidentsQuery,
} from "@/lib/incidents";
import { LIVE_MAX_AGE } from "@/lib/queryCache";
import { cn } from "@/lib/utils";
import { warningsQuery } from "@/lib/warnings";

import {
    IncidentsOutletContext,
    invalidateIncidentLists,
} from "./incidentsContext";

type IncidentTab = "open" | "resolved" | "noteworthy" | "warnings" | "manual";

const TAB_LABELS: Record<IncidentTab, string> = {
    open: "Open",
    resolved: "Resolved",
    noteworthy: "Noteworthy",
    warnings: "Warnings",
    manual: "Manual",
};

const getActiveTab = (pathname: string): IncidentTab => {
    const section = pathname.split("/")[2];
    if (
        section === "resolved" ||
        section === "noteworthy" ||
        section === "warnings" ||
        section === "manual"
    )
        return section;
    return "open";
};

const IncidentsLayout = () => {
    const { pathname } = useLocation();
    const competition = useAtomValue(competitionAtom);
    const [openCount, setOpenCount] = useAtom(unresolvedIncidentsCountAtom);
    const useDevices = !!competition?.useFkmTimeDevices;
    const activeTab = getActiveTab(pathname);
    // An open incident takes the whole screen on mobile
    const isIncidentOpen =
        activeTab === "open" && pathname.replace(/\/$/, "") !== "/incidents";

    // The counts come from the full lists, the same cache entries the tabs
    // show, so a tab and its count can't disagree
    const liveOptions = { maxAge: LIVE_MAX_AGE };
    useLiveQuery(unresolvedIncidentsQuery, {
        ...liveOptions,
        enabled: useDevices,
    });
    const { data: resolved } = useLiveQuery(resolvedIncidentsQuery(), {
        ...liveOptions,
        enabled: useDevices,
    });
    const { data: noteworthy } = useLiveQuery(noteworthyIncidentsQuery(), {
        ...liveOptions,
        enabled: useDevices,
    });
    const { data: warnings } = useLiveQuery(warningsQuery(), liveOptions);
    const { data: manual } = useLiveQuery(manualIncidentsQuery(), liveOptions);
    const counts = {
        resolved: resolved?.length,
        noteworthy: noteworthy?.length,
        warnings: warnings?.length,
        manual: manual?.length,
    };

    // The open count also feeds the navigation badge
    const refreshOpenCount = useCallback(() => {
        if (!useDevices) return;
        getUnresolvedIncidentsCount()
            .then((data) => setOpenCount(data.count))
            .catch(() => undefined);
    }, [useDevices, setOpenCount]);

    useEffect(() => {
        refreshOpenCount();
    }, [refreshOpenCount]);

    const refreshCounts = useCallback(() => {
        invalidateIncidentLists();
        refreshOpenCount();
    }, [refreshOpenCount]);

    // The layout keeps the incidents socket room joined; only listen here.
    // This covers every tab, which render inside the layout.
    useSocketEvents({
        newIncident: refreshCounts,
        attemptUpdated: refreshCounts,
    });

    const activeLabel = TAB_LABELS[activeTab];
    usePageHeader(
        {
            crumbs:
                activeTab === "open"
                    ? [{ label: "Incidents" }]
                    : [
                          {
                              label: "Incidents",
                              to: useDevices ? "/incidents" : undefined,
                          },
                          { label: activeLabel },
                      ],
        },
        !isIncidentOpen
    );

    const tabs: PageTab<IncidentTab>[] = [
        ...(useDevices
            ? ([
                  {
                      value: "open",
                      label: TAB_LABELS.open,
                      count: openCount,
                      to: "/incidents",
                  },
                  {
                      value: "resolved",
                      label: TAB_LABELS.resolved,
                      count: counts.resolved,
                      to: "/incidents/resolved",
                  },
                  {
                      value: "noteworthy",
                      label: TAB_LABELS.noteworthy,
                      count: counts.noteworthy,
                      to: "/incidents/noteworthy",
                  },
              ] as PageTab<IncidentTab>[])
            : []),
        {
            value: "warnings",
            label: TAB_LABELS.warnings,
            count: counts.warnings,
            to: "/incidents/warnings",
        },
        {
            value: "manual",
            label: TAB_LABELS.manual,
            count: counts.manual,
            to: "/incidents/manual",
        },
    ];

    return (
        <div className="flex flex-col gap-5">
            <PageTabs
                label="Incidents"
                tabs={tabs}
                value={activeTab}
                className={cn(
                    "max-md:-mt-4 max-md:bg-card",
                    isIncidentOpen && "max-md:hidden"
                )}
            />
            <Outlet
                context={{ refreshCounts } satisfies IncidentsOutletContext}
            />
        </div>
    );
};

export default IncidentsLayout;
