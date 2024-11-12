import { Box, Heading } from "@chakra-ui/react";
import { useAtom } from "jotai";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getNumberOfAttemptsForRound } from "wcif-helpers";

import LoadingPage from "@/Components/LoadingPage";
import { competitionAtom } from "@/logic/atoms";
import { getCompetitionInfo } from "@/logic/competition";
import { ResultWithAverage, Room } from "@/logic/interfaces";
import {
    getResultsByRoundId,
    orderResultsByAverage,
    resultsWithAverageProperty,
} from "@/logic/results";
import { getAllRooms } from "@/logic/rooms";
import { socket, SocketContext } from "@/socket";

import EventAndRoundSelector from "../../../../Components/EventAndRoundSelector";
import PublicResultsTable from "./Components/PublicResultsTable";

const PublicView = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const filters = {
        eventId: id?.split("-")[0] || "",
        roundId: id || "",
    };
    const [competition, setCompetition] = useAtom(competitionAtom);
    const [results, setResults] = useState<ResultWithAverage[]>([]);
    const [currentRounds, setCurrentRounds] = useState<string[]>([]);

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

    const [isConnected] = useContext(SocketContext) as [
        number,
        React.Dispatch<React.SetStateAction<number>>,
    ];
    useEffect(() => {
        if (filters.roundId) {
            fetchData(filters.roundId);
        } else {
            if (currentRounds.length === 1) {
                navigate(`/results/public/${currentRounds[0]}`);
            }
        }

        socket.emit("joinResults", { roundId: filters.roundId });
        socket.on("resultEntered", () => {
            fetchData(filters.roundId);
        });

        return () => {
            socket.emit("leaveResults", { roundId: filters.roundId });
        };
    }, [fetchData, filters.roundId, navigate, isConnected, currentRounds]);

    useEffect(() => {
        getAllRooms().then((rooms: Room[]) => {
            const ids = new Set<string>(
                rooms
                    .filter((room) => room.currentGroupId)
                    .map((room) => room.currentGroupId.split("-g")[0])
            );
            const idsArray = [...ids];
            setCurrentRounds(idsArray);
        });
    }, []);

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
