import { useAtom } from "jotai";
import { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import PublicResultsBoard from "@/Components/results/PublicResultsBoard";
import { competitionAtom } from "@/lib/atoms";
import { getPublicCompetitionInfo, getPublicRooms } from "@/lib/competition";
import { Result, Room } from "@/lib/interfaces";
import { getPublicResultsByRoundId } from "@/lib/results";
import { socket, SocketContext } from "@/socket";

const PublicResults = () => {
    const { id: roundId = "" } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [competition, setCompetition] = useAtom(competitionAtom);
    const [isConnected] = useContext(SocketContext) as [
        number,
        React.Dispatch<React.SetStateAction<number>>,
    ];
    const [results, setResults] = useState<Result[]>([]);
    const [liveRoundIds, setLiveRoundIds] = useState<string[] | null>(null);

    useEffect(() => {
        if (competition) return;
        getPublicCompetitionInfo().then((response) => {
            if (response.status === 200) setCompetition(response.data);
        });
    }, [competition, setCompetition]);

    useEffect(() => {
        getPublicRooms().then((rooms: Room[]) =>
            setLiveRoundIds([
                ...new Set(
                    (rooms ?? []).flatMap((room) =>
                        room.currentGroupIds.map((id) => id.split("-g")[0])
                    )
                ),
            ])
        );
    }, [isConnected]);

    // Without a round, open the one in progress or the first one
    useEffect(() => {
        if (roundId || !competition || !liveRoundIds) return;
        const first =
            liveRoundIds[0] ?? competition.wcif.events[0]?.rounds[0]?.id;
        if (first) navigate(`/public/results/${first}`, { replace: true });
    }, [roundId, competition, liveRoundIds, navigate]);

    const fetchResults = useCallback(async () => {
        if (!roundId) return;
        setResults(await getPublicResultsByRoundId(roundId));
    }, [roundId]);

    useEffect(() => {
        if (!roundId) return;
        fetchResults();
        socket.emit("joinResults", { roundId });
        socket.on("resultEntered", fetchResults);
        return () => {
            socket.off("resultEntered", fetchResults);
            socket.emit("leaveResults", { roundId });
        };
    }, [roundId, fetchResults, isConnected]);

    if (!competition) return <LoadingPage />;

    return (
        <PublicResultsBoard
            wcif={competition.wcif}
            roundId={roundId}
            results={results}
            liveRoundIds={liveRoundIds ?? []}
            onRoundChange={(id) => navigate(`/public/results/${id}`)}
        />
    );
};

export default PublicResults;
