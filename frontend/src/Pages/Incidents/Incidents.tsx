import { Box, Heading } from "@chakra-ui/react";
import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import io from "socket.io-client";

import LoadingPage from "@/Components/LoadingPage";
import { competitionAtom } from "@/logic/atoms";
import { getUnresolvedAttempts } from "@/logic/attempt";
import { getToken } from "@/logic/auth";
import { getCompetitionInfo } from "@/logic/competition";
import { Incident } from "@/logic/interfaces";
import { INCIDENTS_WEBSOCKET_URL, WEBSOCKET_PATH } from "@/logic/request";

import IncidentCard from "./Components/IncidentCard";

const Incidents = () => {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [competition, setCompetition] = useAtom(competitionAtom);
    const [socket] = useState(
        io(INCIDENTS_WEBSOCKET_URL, {
            transports: ["websocket"],
            path: WEBSOCKET_PATH,
            closeOnBeforeunload: true,
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
