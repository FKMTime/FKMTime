import { QueryKey } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";

import { queryClient } from "@/lib/queryClient";

export interface IncidentsOutletContext {
    /**
     * Call after creating, editing or deleting: refreshes every incident
     * list and the tab counts
     */
    refreshCounts: () => void;
}

export const useIncidentsContext = () =>
    useOutletContext<IncidentsOutletContext>();

const LIST_PATHS = [
    "incident/unresolved",
    "incident/resolved",
    "incident/noteworthy",
    "incident/manual",
    "incident/warnings",
];

/** Whether a query key is one of the incident lists, searched or not */
export const isIncidentListKey = ([path]: QueryKey) =>
    typeof path === "string" &&
    LIST_PATHS.some((list) => path === list || path.startsWith(`${list}?`));

/** Refetches the incident lists on screen and marks the rest out of date */
export const invalidateIncidentLists = () =>
    queryClient.invalidateQueries({
        predicate: (query) => isIncidentListKey(query.queryKey),
    });
