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
import { getPublicCompetitionInfo } from "@/lib/competition";
import { ResultWithAverage } from "@/lib/interfaces";
import {
    getPublicResultsByRoundId,
    orderResultsByAverage,
    resultsWithAverageProperty,
} from "@/lib/results";
import PageTransition from "@/Pages/PageTransition";
import { socket, SocketContext } from "@/socket";

import EventAndRoundSelector from "../../Components/EventAndRoundSelector";
import PublicResultsTable from "../Main/Results/PublicView/Components/PublicResultsTable";

const PublicResults = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const filters = {
        eventId: id?.split("-")[0] || "",
        roundId: id || "",
    };
    const [competition, setCompetition] = useAtom(competitionAtom);
    const [results, setResults] = useState<ResultWithAverage[]>([]);

    const maxAttempts = useMemo(() => {
        if (!competition) return 0;
        return getNumberOfAttemptsForRound(filters.roundId, competition.wcif);
    }, [competition, filters.roundId]);

    const fetchData = useCallback(
        async (roundId: string) => {
            if (!competition || !roundId) return;
            const data = await getPublicResultsByRoundId(roundId);
            const resultsWithAverage = resultsWithAverageProperty(
                data,
                competition.wcif
            );
            setResults(orderResultsByAverage(resultsWithAverage));
        },
        [competition]
    );

    const fetchCompetition = useCallback(async () => {
        if (competition) return;
        const response = await getPublicCompetitionInfo();
        if (response.status === 200) {
            setCompetition(response.data);
        }
    }, [competition, setCompetition]);

    const handleEventChange = (eventId: string) => {
        const roundId = eventId + "-r1";
        navigate(`/public/results/${roundId}`);
    };

    const handleRoundChange = (roundId: string) => {
        navigate(`/public/results/${roundId}`);
    };

    const [isConnected] = useContext(SocketContext) as [
        number,
        React.Dispatch<React.SetStateAction<number>>,
    ];

    useEffect(() => {
        fetchCompetition();
    }, [fetchCompetition]);

    useEffect(() => {
        if (filters.roundId) {
            fetchData(filters.roundId);
        }

        socket.emit("joinResults", { roundId: filters.roundId });
        socket.on("resultEntered", () => fetchData(filters.roundId));

        return () => {
            socket.emit("leaveResults", { roundId: filters.roundId });
            socket.off("resultEntered");
        };
    }, [fetchData, filters.roundId, isConnected]);

    if (!competition) return <LoadingPage />;

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
                        {results.length > 0 ? (
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

export default PublicResults;
