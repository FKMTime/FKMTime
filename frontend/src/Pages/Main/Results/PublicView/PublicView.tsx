import { useAtomValue } from "jotai";
import { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import PublicResultsBoard from "@/Components/results/PublicResultsBoard";
import { usePageHeader } from "@/hooks/usePageHeader";
import { competitionAtom } from "@/lib/atoms";
import { Result, Room } from "@/lib/interfaces";
import { getResultsByRoundId } from "@/lib/results";
import { getAllRooms } from "@/lib/rooms";
import { shortRoundName } from "@/lib/utils";
import { socket, SocketContext } from "@/socket";

/** Staff copy of the public results; also the Results page for non-delegates */
const PublicView = () => {
    const { id: roundId = "" } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const competition = useAtomValue(competitionAtom);
    const [isConnected] = useContext(SocketContext) as [
        number,
        React.Dispatch<React.SetStateAction<number>>,
    ];
    const [results, setResults] = useState<Result[]>([]);
    const [liveRoundIds, setLiveRoundIds] = useState<string[] | null>(null);

    usePageHeader({
        crumbs: roundId
            ? [
                  { label: "Results", to: "/results" },
                  {
                      label: shortRoundName(roundId),
                      to: `/results/round/${roundId}`,
                  },
                  { label: "Public view" },
              ]
            : [{ label: "Results" }],
    });

    useEffect(() => {
        getAllRooms().then((rooms: Room[]) =>
            setLiveRoundIds([
                ...new Set(
                    rooms.flatMap((room) =>
                        room.currentGroupIds.map((id) => id.split("-g")[0])
                    )
                ),
            ])
        );
    }, []);

    // Without a round, open the one in progress or the first one
    useEffect(() => {
        if (roundId || !competition || !liveRoundIds) return;
        const first =
            liveRoundIds[0] ?? competition.wcif.events[0]?.rounds[0]?.id;
        if (first) navigate(`/results/public/${first}`, { replace: true });
    }, [roundId, competition, liveRoundIds, navigate]);

    const fetchResults = useCallback(async () => {
        if (!roundId) return;
        setResults(await getResultsByRoundId(roundId));
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
            onRoundChange={(id) => navigate(`/results/public/${id}`)}
        />
    );
};

export default PublicView;
