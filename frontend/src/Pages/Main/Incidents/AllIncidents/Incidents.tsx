import { Box, Button, Heading } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getUnresolvedAttempts } from "@/logic/attempt";
import { Incident } from "@/logic/interfaces";
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
        <Box display="flex" flexDirection="column" gap="5">
            <Heading size="lg">Incidents</Heading>
            <Button
                colorPalette="yellow"
                width={{ base: "100%", md: "fit-content" }}
                onClick={() => navigate("/incidents/resolved")}
            >
                Resolved incidents
            </Button>
            <Box
                display="flex"
                flexDirection="row"
                gap="5"
                flexWrap="wrap"
                justifyContent={{ base: "center", md: "left" }}
            >
                {incidents.length === 0 && (
                    <Heading size="md">No incidents</Heading>
                )}
                {incidents.map((incident) => (
                    <IncidentCard incident={incident} key={incident.id} />
                ))}
            </Box>
        </Box>
    );
};

export default Incidents;
