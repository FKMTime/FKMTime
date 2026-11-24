import { Trophy } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import H2hBracket from "@/Components/h2h/H2hBracket";
import EmptyState from "@/Components/shared/EmptyState";
import RequestError from "@/Components/shared/RequestError";
import SectionLoading from "@/Components/shared/SectionLoading";
import { Button } from "@/Components/ui/button";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useSocketRoom } from "@/hooks/useSocketRoom";
import { getEventIconClass, getEventName } from "@/lib/events";
import {
    playingMatches,
    publicH2hQuery,
    publicScoreboardPath,
} from "@/lib/h2hPublic";
import { QueryError } from "@/lib/queryCache";
import { cn } from "@/lib/utils";

/** A head-to-head round's bracket for spectators, updated live */
const PublicH2hBracket = () => {
    const { roundId = "" } = useParams<{ roundId: string }>();
    const query = publicH2hQuery(roundId);
    const {
        data: view,
        error,
        refetch,
    } = useLiveQuery(query, {
        enabled: !!roundId,
    });
    useSocketRoom(roundId ? "H2h" : null, {
        params: { roundId },
        invalidateOn: { h2hUpdated: [query.key] },
    });
    const eventId = roundId.split("-r")[0];
    const playing = view ? playingMatches(view) : [];

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
                <span
                    aria-hidden
                    className={cn(
                        "cubing-icon text-[22px]",
                        getEventIconClass(eventId)
                    )}
                />
                <div className="flex min-w-40 flex-1 flex-col gap-0.5">
                    <h2 className="text-base font-bold">
                        {getEventName(eventId)} · Round {roundId.split("-r")[1]}
                    </h2>
                    <p className="text-[13px] text-muted-foreground">
                        Head to head
                        {view && ` · ${view.size} competitors`}
                    </p>
                </div>
                {playing.map((match) => (
                    <Button key={match.id} asChild variant="outline">
                        <Link
                            to={publicScoreboardPath(
                                roundId,
                                match.matchNumber
                            )}
                        >
                            {match.label} scoreboard
                        </Link>
                    </Button>
                ))}
            </div>
            {view ? (
                <H2hBracket view={view} />
            ) : error instanceof QueryError && error.status === 404 ? (
                <EmptyState icon={<Trophy />}>
                    The bracket for this round isn't ready yet.
                </EmptyState>
            ) : error ? (
                <RequestError onRetry={() => void refetch()} />
            ) : (
                <SectionLoading label="Loading the bracket" />
            )}
        </div>
    );
};

export default PublicH2hBracket;
