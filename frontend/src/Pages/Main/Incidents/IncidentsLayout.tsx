import { useAtom, useAtomValue } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import PageTabs, { PageTab } from "@/Components/shared/PageTabs";
import { usePageHeader } from "@/hooks/usePageHeader";
import { competitionAtom, unresolvedIncidentsCountAtom } from "@/lib/atoms";
import {
    getUnresolvedIncidentsCount,
    manualIncidentsQuery,
    noteworthyIncidentsQuery,
    resolvedIncidentsQuery,
    unresolvedIncidentsQuery,
} from "@/lib/incidents";
import { fetchQuery, LIVE_MAX_AGE, prefetchQuery } from "@/lib/queryCache";
import { cn } from "@/lib/utils";
import { warningsQuery } from "@/lib/warnings";
import { socket } from "@/socket";

import { IncidentsOutletContext } from "./incidentsContext";

type IncidentTab = "open" | "resolved" | "noteworthy" | "warnings" | "manual";

interface IncidentCounts {
    resolved?: number;
    noteworthy?: number;
    warnings?: number;
    manual?: number;
}

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
    const [counts, setCounts] = useState<IncidentCounts>({});
    const useDevices = !!competition?.useFkmTimeDevices;
    const activeTab = getActiveTab(pathname);
    // An open incident takes the whole screen on mobile
    const isIncidentOpen =
        activeTab === "open" && pathname.replace(/\/$/, "") !== "/incidents";

    // The counts come from the full lists, which also fills each tab's cache
    const loadCounts = useCallback(
        async (reuseRunning: boolean) => {
            const options = { reuseRunning };
            const [open, resolved, noteworthy, warnings, manual] =
                await Promise.all([
                    useDevices ? getUnresolvedIncidentsCount() : undefined,
                    useDevices
                        ? fetchQuery(resolvedIncidentsQuery(), options)
                        : undefined,
                    useDevices
                        ? fetchQuery(noteworthyIncidentsQuery(), options)
                        : undefined,
                    fetchQuery(warningsQuery(), options),
                    fetchQuery(manualIncidentsQuery(), options),
                ]);
            if (open) setOpenCount(open.count);
            setCounts({
                resolved: resolved?.length,
                noteworthy: noteworthy?.length,
                warnings: warnings.length,
                manual: manual.length,
            });
        },
        [useDevices, setOpenCount]
    );

    const refreshCounts = useCallback(() => {
        loadCounts(false).catch(() => undefined);
    }, [loadCounts]);

    useEffect(() => {
        // The open tab's own load may already be on its way
        loadCounts(true).catch(() => undefined);
        if (useDevices) {
            prefetchQuery(unresolvedIncidentsQuery, { maxAge: LIVE_MAX_AGE });
        }
        // The layout keeps the incidents socket room joined; only listen here
        socket.on("newIncident", refreshCounts);
        socket.on("attemptUpdated", refreshCounts);
        return () => {
            socket.off("newIncident", refreshCounts);
            socket.off("attemptUpdated", refreshCounts);
        };
    }, [loadCounts, refreshCounts, useDevices]);

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
