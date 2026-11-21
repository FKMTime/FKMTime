import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import EmptyState from "@/Components/shared/EmptyState";
import RequestError from "@/Components/shared/RequestError";
import { useDelegateAccess } from "@/hooks/useDelegateAccess";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { unresolvedIncidentsQuery } from "@/lib/incidents";
import { LIVE_MAX_AGE } from "@/lib/queryCache";
import { roomsQuery } from "@/lib/rooms";
import { tutorialIncidentsQuery } from "@/lib/tutorial";
import { cn } from "@/lib/utils";

import { useIncidentsContext } from "../incidentsContext";
import IncidentListItem from "./IncidentListItem";
import IncidentPanel from "./IncidentPanel";
import TutorialIncidentListItem from "./TutorialIncidentListItem";
import TutorialIncidentPanel from "./TutorialIncidentPanel";

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
    // Delegate calls made during a tutorial, kept in memory (SPEC-012); for
    // delegates only, delegate access for a group doesn't cover them
    const { isDelegate } = useDelegateAccess();
    const { data: tutorialData } = useLiveQuery(tutorialIncidentsQuery, {
        maxAge: LIVE_MAX_AGE,
        enabled: isDelegate,
    });
    const tutorialIncidents = tutorialData ?? [];
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

    const roomName = (roomId?: string) =>
        rooms.find((room) => room.id === roomId)?.name;
    const tutorialIncident = id?.startsWith("tutorial-")
        ? tutorialIncidents.find((incident) => incident.id === id)
        : undefined;
    const isEmpty = incidents.length === 0 && tutorialIncidents.length === 0;

    return (
        <>
            {isError && <RequestError hasData onRetry={retry} />}
            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
                <div
                    className={cn("flex flex-col gap-3", id && "max-lg:hidden")}
                >
                    {isEmpty && <EmptyState>No open incidents.</EmptyState>}
                    {tutorialIncidents.map((incident) => (
                        <TutorialIncidentListItem
                            key={incident.id}
                            incident={incident}
                            roomName={roomName(incident.roomId)}
                            isSelected={incident.id === id}
                            now={now}
                        />
                    ))}
                    {incidents.map((incident) => (
                        <IncidentListItem
                            key={incident.id}
                            incident={incident}
                            roomName={roomName(incident.device?.roomId)}
                            isSelected={incident.id === id}
                            now={now}
                        />
                    ))}
                </div>
                {tutorialIncident ? (
                    <TutorialIncidentPanel
                        key={tutorialIncident.id}
                        incident={tutorialIncident}
                        onClose={() => navigate("/incidents")}
                        onDone={handleDone}
                    />
                ) : id?.startsWith("tutorial-") ? (
                    !tutorialData ? (
                        <LoadingPage />
                    ) : (
                        <EmptyState>
                            The station stopped waiting for this tutorial
                            incident.
                        </EmptyState>
                    )
                ) : id ? (
                    <IncidentPanel
                        key={id}
                        id={id}
                        onClose={() => navigate("/incidents")}
                        onDone={handleDone}
                    />
                ) : (
                    !isEmpty && (
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
