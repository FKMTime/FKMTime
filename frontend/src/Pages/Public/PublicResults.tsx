import { useAtomValue } from "jotai";
import { useEffect } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import PublicResultsBoard from "@/Components/results/PublicResultsBoard";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useSocketRoom } from "@/hooks/useSocketRoom";
import { competitionAtom } from "@/lib/atoms";
import { publicH2hPath, publicH2hQuery } from "@/lib/h2hPublic";
import { Result } from "@/lib/interfaces";
import { publicRoundResultsQuery } from "@/lib/results";

import { getH2hRoundIds, PublicOutletContext } from "./publicNavigation";

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
    // A head-to-head round ranks by its bracket
    const isH2h = getH2hRoundIds(competition?.wcif).includes(roundId);
    const h2hQuery = publicH2hQuery(roundId);
    const { data: h2h } = useLiveQuery(h2hQuery, { enabled: isH2h });
    useSocketRoom(isH2h ? "H2h" : null, {
        params: { roundId },
        invalidateOn: { h2hUpdated: [h2hQuery.key] },
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
            h2h={isH2h ? h2h : null}
            bracketHref={publicH2hPath(roundId)}
        />
    );
};

export default PublicResults;
