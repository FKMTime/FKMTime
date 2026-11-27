import { useAtomValue } from "jotai";
import { useEffect, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import PublicResultsBoard from "@/Components/results/PublicResultsBoard";
import { Button } from "@/Components/ui/button";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { usePageHeader } from "@/hooks/usePageHeader";
import { useSocketRoom } from "@/hooks/useSocketRoom";
import { competitionAtom } from "@/lib/atoms";
import { publicH2hPath, publicH2hQuery } from "@/lib/h2hPublic";
import { Result } from "@/lib/interfaces";
import { isStageLeaderOrOrganizerOrDelegate } from "@/lib/permissions";
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
    // A head-to-head round ranks by its bracket
    const isH2h =
        competition?.wcif.events
            .flatMap((event) => event.rounds)
            .find((round) => round.id === roundId)?.format === "h";
    const h2hQuery = publicH2hQuery(roundId);
    const {
        data: h2h,
        error: h2hError,
        refetch: refetchH2h,
    } = useLiveQuery(h2hQuery, { enabled: isH2h });
    useSocketRoom(isH2h ? "H2h" : null, {
        params: { roundId },
        invalidateOn: { h2hUpdated: [h2hQuery.key] },
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
        <>
            {/* Stage leaders start a head-to-head round's matches from its page */}
            {isH2h && isStageLeaderOrOrganizerOrDelegate() && (
                <Button asChild variant="outline" className="self-start">
                    <Link to={`/results/round/${roundId}?tab=matches`}>
                        Run the matches
                    </Link>
                </Button>
            )}
            <PublicResultsBoard
                wcif={competition.wcif}
                roundId={roundId}
                results={results}
                liveRoundIds={liveRoundIds ?? []}
                onRoundChange={(id) => navigate(`/results/public/${id}`)}
                h2h={isH2h ? h2h : null}
                h2hError={isH2h ? h2hError : null}
                onRetryH2h={() => void refetchH2h()}
                bracketHref={publicH2hPath(roundId)}
            />
        </>
    );
};

export default PublicView;
