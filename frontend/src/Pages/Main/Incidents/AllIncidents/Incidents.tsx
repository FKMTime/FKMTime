import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { getUnresolvedAttempts } from "@/lib/attempt";
import { Incident } from "@/lib/interfaces";
import PageTransition from "@/Pages/PageTransition";
import { socket } from "@/socket";

import IncidentCard from "./Components/IncidentCard";

const Incidents = () => {
    const navigate = useNavigate();
    const [incidents, setIncidents] = useState<Incident[]>([]);

    const fetchData = async () => {
        const data = await getUnresolvedAttempts();
        setIncidents(data);
    };
    useEffect(() => {
        fetchData();
        socket.emit("joinIncidents");

        socket.on("newIncident", () => {
            fetchData();
        });

        socket.on("attemptUpdated", () => {
            fetchData();
        });

        return () => {
            socket.emit("leaveIncidents");
        };
    }, []);

    return (
        <PageTransition>
            <div className="flex flex-col gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Incidents</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => navigate("/incidents/resolved")}>
                            Resolved incidents
                        </Button>
                    </CardContent>
                </Card>
                <div className="flex flex-row gap-4 flex-wrap justify-center md:justify-start">
                    {incidents.length === 0 && (
                        <h2 className="text-lg">No incidents</h2>
                    )}
                    {incidents.map((incident) => (
                        <IncidentCard incident={incident} key={incident.id} />
                    ))}
                </div>
            </div>
        </PageTransition>
    );
};

export default Incidents;
