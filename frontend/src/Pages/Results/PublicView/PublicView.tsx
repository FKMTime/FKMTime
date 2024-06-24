import { Box, Heading } from "@chakra-ui/react";
import { useAtom } from "jotai";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";

import LoadingPage from "@/Components/LoadingPage";
import { competitionAtom } from "@/logic/atoms";
import { getToken } from "@/logic/auth";
import { getCompetitionInfo } from "@/logic/competition";
import { ResultWithAverage } from "@/logic/interfaces";
import { RESULTS_WEBSOCKET_URL, WEBSOCKET_PATH } from "@/logic/request";
import {
    getResultsByRoundId,
    orderResultsByAverage,
    resultsWithAverageProperty,
} from "@/logic/results";
import { getNumberOfAttemptsForRound } from "@/logic/utils";

import EventAndRoundSelector from "../Components/EventAndRoundSelector";
import PublicResultsTable from "./Components/PublicResultsTable";

const PublicView = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const filters = {
        eventId: id?.split("-")[0] || "",
        roundId: id || "",
    };
    const [socket] = useState(
        io(RESULTS_WEBSOCKET_URL, {
            transports: ["websocket"],
            path: WEBSOCKET_PATH,
            closeOnBeforeunload: true,
            auth: {
                token: getToken(),
            },
        })
    );
    const [competition, setCompetition] = useAtom(competitionAtom);
    const [results, setResults] = useState<ResultWithAverage[]>([]);

    const maxAttempts = useMemo(() => {
        if (!competition) {
            return 0;
        }
        return getNumberOfAttemptsForRound(filters.roundId, competition.wcif);
    }, [competition, filters.roundId]);

    const fetchData = useCallback(
        async (roundId: string) => {
            const data = await getResultsByRoundId(roundId);
            if (!competition) return;
            const resultsWithAverage = resultsWithAverageProperty(
                data,
                competition.wcif
            );
            if (roundId === filters.roundId && roundId !== "") {
                setResults(orderResultsByAverage(resultsWithAverage));
            }
        },
        [competition, filters.roundId]
    );

    const fetchCompetition = useCallback(async () => {
        const response = await getCompetitionInfo();
        if (response.status !== 200) {
            navigate("/competition");
        }
        setCompetition(response.data);
    }, [navigate, setCompetition]);

    const handleEventChange = async (eventId: string) => {
        const roundId = eventId + "-r1";
        navigate(`/results/public/${roundId}`);
        await fetchData(roundId);
    };

    const handleRoundChange = (roundId: string) => {
        navigate(`/results/public/${roundId}`);
    };

    useEffect(() => {
        if (!competition) {
            fetchCompetition();
        }
    }, [competition, fetchCompetition]);

    useEffect(() => {
        if (filters.roundId) {
            fetchData(filters.roundId);
        }

        socket.emit("join", { roundId: filters.roundId });

        socket.on("resultEntered", () => {
            fetchData(filters.roundId);
        });

        return () => {
            socket.emit("leave", { roundId: filters.roundId });
        };
    }, [fetchData, filters.roundId, navigate, socket]);

    if (!competition || !results) {
        return <LoadingPage />;
    }

    return (
        <Box display="flex" flexDirection="column" gap="5">
            <Box
                display="flex"
                flexDirection={{ base: "column", md: "row" }}
                gap="5"
            >
                <EventAndRoundSelector
                    competition={competition}
                    filters={filters}
                    handleEventChange={handleEventChange}
                    handleRoundChange={handleRoundChange}
                />
            </Box>
            {results && results.length > 0 ? (
                <PublicResultsTable
                    results={results}
                    maxAttempts={maxAttempts}
                />
            ) : (
                <Heading size="lg">No results found</Heading>
            )}
        </Box>
    );
};

export default PublicView;
