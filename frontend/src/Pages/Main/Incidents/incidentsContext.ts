import { useOutletContext } from "react-router-dom";

export interface IncidentsOutletContext {
    /** Call after creating, editing or deleting so the tab counts stay right */
    refreshCounts: () => void;
}

export const useIncidentsContext = () =>
    useOutletContext<IncidentsOutletContext>();
