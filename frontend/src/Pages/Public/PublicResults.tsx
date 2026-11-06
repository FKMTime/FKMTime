import { useAtomValue } from "jotai";
import { useEffect } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import PublicResultsBoard from "@/Components/results/PublicResultsBoard";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useSocketRoom } from "@/hooks/useSocketRoom";
import { competitionAtom } from "@/lib/atoms";
import { Result } from "@/lib/interfaces";
import { publicRoundResultsQuery } from "@/lib/results";

import { PublicOutletContext } from "./publicNavigation";

const PublicResults = () => {
    const { id: roundId = "" } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const competition = useAtomValue(competitionAtom);
    const { liveRoundIds } = useOutletContext<PublicOutletContext>();
    // The last round's results stay while the next round loads
    const resultsQuery = publicRoundResultsQuery(roundId);
    const { data } = useLiveQuery(resultsQuery, {
        keepPreviousData: true,
        enabled: !!roundId,
    });
    const results: Result[] = data ?? [];
    useSocketRoom(roundId ? "Results" : null, {
        params: { roundId },
        invalidateOn: { resultEntered: [resultsQuery.key] },
    });

    // Without a round, open the one in progress or the first one
    useEffect(() => {
        if (roundId || !competition || !liveRoundIds) return;
        const first =
            liveRoundIds[0] ?? competition.wcif.events[0]?.rounds[0]?.id;
        if (first) navigate(`/public/results/${first}`, { replace: true });
    }, [roundId, competition, liveRoundIds, navigate]);

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
