import { useEffect, useState } from "react";
import { Box, Heading } from "@chakra-ui/react";
import { Incident } from "../../logic/interfaces.ts";
import { getUnresolvedAttempts } from "../../logic/attempt.ts";
import IncidentCard from "../../Components/IncidentCard.tsx";
import { useAtom } from "jotai";
import { getCompetitionInfo } from "../../logic/competition.ts";
import { competitionAtom } from "../../logic/atoms.ts";
import LoadingPage from "../../Components/LoadingPage.tsx";
import io from "socket.io-client";
import { INCIDENTS_WEBSOCKET_URL } from "../../logic/request.ts";
import { getToken } from "../../logic/auth.ts";

const Incidents = () => {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [competition, setCompetition] = useAtom(competitionAtom);
    const [socket] = useState(
        io(INCIDENTS_WEBSOCKET_URL, {
            transports: ["websocket"],
            auth: {
                token: getToken(),
            },
        })
    );

    const fetchData = async () => {
        const data = await getUnresolvedAttempts();
        setIncidents(data);
    };
    useEffect(() => {
        fetchData();
        socket.emit("join");

        socket.on("newIncident", () => {
            fetchData();
        });

        socket.on("attemptUpdated", () => {
            fetchData();
        });

        return () => {
            socket.emit("leave");
        };
    }, [socket]);

    useEffect(() => {
        if (!competition) {
            getCompetitionInfo().then((res) => {
                setCompetition(res.data);
            });
        }
    }, [competition, setCompetition]);

    if (!competition) {
        return <LoadingPage />;
    }

    return (
        <Box display="flex" flexDirection="column" gap="5">
            <Heading size="lg">Incidents</Heading>
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
                    <IncidentCard
                        incident={incident}
                        key={incident.id}
                        wcif={competition.wcif}
                    />
                ))}
            </Box>
        </Box>
    );
};

export default Incidents;
