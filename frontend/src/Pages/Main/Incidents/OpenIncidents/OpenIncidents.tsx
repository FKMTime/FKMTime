import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import EmptyState from "@/Components/shared/EmptyState";
import RequestError from "@/Components/shared/RequestError";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { unresolvedIncidentsQuery } from "@/lib/incidents";
import { LIVE_MAX_AGE } from "@/lib/queryCache";
import { roomsQuery } from "@/lib/rooms";
import { cn } from "@/lib/utils";

import { useIncidentsContext } from "../incidentsContext";
import IncidentListItem from "./IncidentListItem";
import IncidentPanel from "./IncidentPanel";

/** Open incidents; /incidents/:id opens the resolve panel next to the list */
const OpenIncidents = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { refreshCounts } = useIncidentsContext();
    // IncidentsLayout refreshes the list on incident events
    const {
        data: incidents,
        dataUpdatedAt,
        isError,
        refetch,
    } = useLiveQuery(unresolvedIncidentsQuery, { maxAge: LIVE_MAX_AGE });
    const { data: rooms = [] } = useLiveQuery(roomsQuery);
    // Elapsed times count from when the list was loaded
    const now = useMemo(() => new Date(dataUpdatedAt), [dataUpdatedAt]);
    const retry = () => void refetch();

    const handleDone = () => {
        refreshCounts();
        navigate("/incidents");
    };

    if (!incidents) {
        return isError ? <RequestError onRetry={retry} /> : <LoadingPage />;
    }

    return (
        <>
            {isError && <RequestError hasData onRetry={retry} />}
            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
                <div
                    className={cn("flex flex-col gap-3", id && "max-lg:hidden")}
                >
                    {incidents.length === 0 ? (
                        <EmptyState>No open incidents.</EmptyState>
                    ) : (
                        incidents.map((incident) => (
                            <IncidentListItem
                                key={incident.id}
                                incident={incident}
                                roomName={
                                    rooms.find(
                                        (room) =>
                                            room.id === incident.device?.roomId
                                    )?.name
                                }
                                isSelected={incident.id === id}
                                now={now}
                            />
                        ))
                    )}
                </div>
                {id ? (
                    <IncidentPanel
                        key={id}
                        id={id}
                        onClose={() => navigate("/incidents")}
                        onDone={handleDone}
                    />
                ) : (
                    incidents.length > 0 && (
                        <EmptyState className="hidden lg:flex">
                            Select an incident to review it.
                        </EmptyState>
                    )
                )}
            </div>
        </>
    );
};

export default OpenIncidents;
