import { useAtomValue } from "jotai";
import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import PublicResultsBoard from "@/Components/results/PublicResultsBoard";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { usePageHeader } from "@/hooks/usePageHeader";
import { useSocketRoom } from "@/hooks/useSocketRoom";
import { competitionAtom } from "@/lib/atoms";
import { Result } from "@/lib/interfaces";
import { roundResultsQuery } from "@/lib/results";
import { roomsQuery } from "@/lib/rooms";
import { shortRoundName } from "@/lib/utils";

/** Staff copy of the public results; also the Results page for non-delegates */
const PublicView = () => {
    const { id: roundId = "" } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const competition = useAtomValue(competitionAtom);
    const { data: rooms } = useLiveQuery(roomsQuery);
    const liveRoundIds = useMemo(
        () =>
            rooms
                ? [
                      ...new Set(
                          rooms.flatMap((room) =>
                              room.currentGroupIds.map(
                                  (id) => id.split("-g")[0]
                              )
                          )
                      ),
                  ]
                : null,
        [rooms]
    );
    // The last round's results stay while the next round loads
    const resultsQuery = roundResultsQuery(roundId);
    const { data } = useLiveQuery(resultsQuery, {
        keepPreviousData: true,
        enabled: !!roundId,
    });
    const results: Result[] = data ?? [];
    useSocketRoom(roundId ? "Results" : null, {
        params: { roundId },
        invalidateOn: { resultEntered: [resultsQuery.key] },
    });

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

    // Without a round, open the one in progress or the first one
    useEffect(() => {
        if (roundId || !competition || !liveRoundIds) return;
        const first =
            liveRoundIds[0] ?? competition.wcif.events[0]?.rounds[0]?.id;
        if (first) navigate(`/results/public/${first}`, { replace: true });
    }, [roundId, competition, liveRoundIds, navigate]);

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
