import { useAtom } from "jotai";
import { AlarmClock } from "lucide-react";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getNumberOfAttemptsForRound } from "wcif-helpers";

import EventIcon from "@/Components/Icons/EventIcon";
import LoadingPage from "@/Components/LoadingPage";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { activityCodeToName } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";
import { getCompetitionInfo } from "@/lib/competition";
import { ResultWithAverage, Room } from "@/lib/interfaces";
import {
    getResultsByRoundId,
    orderResultsByAverage,
    resultsWithAverageProperty,
} from "@/lib/results";
import { getAllRooms } from "@/lib/rooms";
import PageTransition from "@/Pages/PageTransition";
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
                    .flatMap((room: Room) => room.currentGroupIds)
                    .map((groupId: string) => groupId.split("-g")[0])
            );
            const idsArray = [...ids];
            setCurrentRounds(idsArray);
        });
    }, []);

    if (!competition || !results) {
        return <LoadingPage />;
    }

    return (
        <PageTransition>
            <div className="flex flex-col gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlarmClock size={20} />
                            Results
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-5">
                        <EventAndRoundSelector
                            competition={competition}
                            filters={filters}
                            handleEventChange={handleEventChange}
                            handleRoundChange={handleRoundChange}
                        />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <EventIcon
                                eventId={filters.eventId}
                                size={20}
                                selected
                            />
                            {activityCodeToName(filters.roundId)}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {results && results.length > 0 ? (
                            <PublicResultsTable
                                results={results}
                                maxAttempts={maxAttempts}
                            />
                        ) : (
                            <h2 className="text-lg">No results found</h2>
                        )}
                    </CardContent>
                </Card>
            </div>
        </PageTransition>
    );
};

export default PublicView;
