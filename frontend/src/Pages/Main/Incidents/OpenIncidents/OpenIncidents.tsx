import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import EmptyState from "@/Components/shared/EmptyState";
import { getUnresolvedIncidents } from "@/lib/incidents";
import { Incident, Room } from "@/lib/interfaces";
import { getAllRooms } from "@/lib/rooms";
import { cn } from "@/lib/utils";
import { socket } from "@/socket";

import { useIncidentsContext } from "../incidentsContext";
import IncidentListItem from "./IncidentListItem";
import IncidentPanel from "./IncidentPanel";

/** Open incidents; /incidents/:id opens the resolve panel next to the list */
const OpenIncidents = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { refreshCounts } = useIncidentsContext();
    const [incidents, setIncidents] = useState<Incident[] | null>(null);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [now, setNow] = useState(() => new Date());

    const fetchIncidents = useCallback(async () => {
        setIncidents(await getUnresolvedIncidents());
        setNow(new Date());
    }, []);

    useEffect(() => {
        fetchIncidents();
        getAllRooms().then(setRooms);
        socket.on("newIncident", fetchIncidents);
        socket.on("attemptUpdated", fetchIncidents);
        return () => {
            socket.off("newIncident", fetchIncidents);
            socket.off("attemptUpdated", fetchIncidents);
        };
    }, [fetchIncidents]);

    const handleDone = () => {
        fetchIncidents();
        refreshCounts();
        navigate("/incidents");
    };

    if (!incidents) return <LoadingPage />;

    return (
        <div className="grid items-start gap-5 lg:grid-cols-2">
            <div className={cn("flex flex-col gap-3", id && "max-lg:hidden")}>
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
    );
};

export default OpenIncidents;
