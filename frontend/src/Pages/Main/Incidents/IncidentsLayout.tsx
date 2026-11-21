import { useAtom, useAtomValue } from "jotai";
import { useCallback, useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import PageTabs, { PageTab } from "@/Components/shared/PageTabs";
import { useDelegateAccess } from "@/hooks/useDelegateAccess";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { usePageHeader } from "@/hooks/usePageHeader";
import { useSocketEvents } from "@/hooks/useSocketEvents";
import { competitionAtom, unresolvedIncidentsCountAtom } from "@/lib/atoms";
import { delegateGrantsQuery, grantState } from "@/lib/delegateGrants";
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

type IncidentTab =
    | "open"
    | "resolved"
    | "noteworthy"
    | "warnings"
    | "manual"
    | "access";

const TAB_LABELS: Record<IncidentTab, string> = {
    open: "Open",
    resolved: "Resolved",
    noteworthy: "Noteworthy",
    warnings: "Warnings",
    manual: "Manual",
    access: "Delegate access",
};

const getActiveTab = (pathname: string): IncidentTab => {
    const section = pathname.split("/")[2];
    if (
        section === "resolved" ||
        section === "noteworthy" ||
        section === "warnings" ||
        section === "manual" ||
        section === "access"
    )
        return section;
    return "open";
};

const IncidentsLayout = () => {
    const { pathname } = useLocation();
    const competition = useAtomValue(competitionAtom);
    const [openCount, setOpenCount] = useAtom(unresolvedIncidentsCountAtom);
    const useDevices = !!competition?.useFkmTimeDevices;
    // Users with delegate access for a group see only the open incidents it
    // covers; the rest is history, which stays with delegates (SPEC-013)
    const { isDelegate, canSeeIncidents, isLoaded } = useDelegateAccess();
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
        enabled: useDevices && isDelegate,
    });
    const { data: noteworthy } = useLiveQuery(noteworthyIncidentsQuery(), {
        ...liveOptions,
        enabled: useDevices && isDelegate,
    });
    const { data: warnings } = useLiveQuery(warningsQuery(), {
        ...liveOptions,
        enabled: isDelegate,
    });
    const { data: manual } = useLiveQuery(manualIncidentsQuery(), {
        ...liveOptions,
        enabled: isDelegate,
    });
    const { data: grants } = useLiveQuery(delegateGrantsQuery(), {
        ...liveOptions,
        enabled: useDevices && isDelegate,
    });
    const counts = {
        resolved: resolved?.length,
        noteworthy: noteworthy?.length,
        warnings: warnings?.length,
        manual: manual?.length,
        access: grants?.filter((grant) => grantState(grant) !== "ended").length,
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

    const delegateTabs: PageTab<IncidentTab>[] = [
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
        ...(useDevices
            ? ([
                  {
                      value: "access",
                      label: TAB_LABELS.access,
                      count: counts.access,
                      to: "/incidents/access",
                  },
              ] as PageTab<IncidentTab>[])
            : []),
    ];
    const tabs: PageTab<IncidentTab>[] = isDelegate
        ? delegateTabs
        : delegateTabs.filter((tab) => tab.value === "open");

    // Access that ended leaves nothing here to act on; the banner says why
    if (isLoaded && !canSeeIncidents) {
        return <Navigate to="/" replace />;
    }
    if (!isDelegate && activeTab !== "open") {
        return <Navigate to="/incidents" replace />;
    }

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
