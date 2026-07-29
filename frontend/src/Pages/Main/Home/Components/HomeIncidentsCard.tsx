import { AlertTriangle, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import EventIcon from "@/Components/Icons/EventIcon";
import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { activityCodeToName } from "@/lib/activities";
import { getUnresolvedIncidents } from "@/lib/incidents";
import { Incident } from "@/lib/interfaces";
import { socket } from "@/socket";

const HomeIncidentsCard = () => {
    const navigate = useNavigate();
    const [incidents, setIncidents] = useState<Incident[]>([]);

    const fetchData = async () => {
        const data = await getUnresolvedIncidents();
        setIncidents(data.slice(0, 5));
    };

    useEffect(() => {
        fetchData();
        socket.emit("joinIncidents");
        socket.on("newIncident", fetchData);
        socket.on("attemptUpdated", fetchData);
        return () => {
            socket.emit("leaveIncidents");
        };
    }, []);

    if (incidents.length === 0) return null;

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="flex gap-2 items-center text-base">
                    <AlertTriangle size={18} />
                    Incidents ({incidents.length}
                    {incidents.length === 5 ? "+" : ""})
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
                {incidents.map((incident) => (
                    <div
                        key={incident.id}
                        className="group flex items-center justify-between text-sm cursor-pointer hover:bg-muted/60 rounded px-1 -mx-1 py-1.5 transition-colors"
                        onClick={() => navigate(`/incidents/${incident.id}`)}
                    >
                        <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="font-medium underline underline-offset-2 md:no-underline md:group-hover:underline truncate">
                                {incident.result.person.name}
                                {incident.device
                                    ? ` - ${incident.device.name}`
                                    : ""}
                            </span>
                            <div className="flex gap-1 items-center text-muted-foreground text-xs">
                                <EventIcon
                                    selected
                                    eventId={incident.result.eventId}
                                    size={12}
                                />
                                {activityCodeToName(
                                    incident.result.roundId,
                                    true,
                                    true
                                )}{" "}
                                A{incident.attemptNumber}
                            </div>
                        </div>
                        <ChevronRight
                            size={14}
                            className="shrink-0 text-muted-foreground opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                        />
                    </div>
                ))}
                <Button
                    size="sm"
                    className="self-start mt-2"
                    onClick={() => navigate("/incidents")}
                >
                    View all incidents
                </Button>
            </CardContent>
        </Card>
    );
};

export default HomeIncidentsCard;
