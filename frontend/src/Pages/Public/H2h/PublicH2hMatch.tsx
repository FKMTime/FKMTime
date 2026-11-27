import { useAtom } from "jotai";
import { ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import H2hScoreboard from "@/Components/h2h/H2hScoreboard";
import EmptyState from "@/Components/shared/EmptyState";
import RequestError from "@/Components/shared/RequestError";
import SectionLoading from "@/Components/shared/SectionLoading";
import { StatusDot } from "@/Components/shared/StatusBadge";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useLiveStations } from "@/hooks/useLiveStations";
import { useRefetchOnReconnect } from "@/hooks/useRefetchOnReconnect";
import { useSocketRoom } from "@/hooks/useSocketRoom";
import { useWakeLock } from "@/hooks/useWakeLock";
import { competitionAtom } from "@/lib/atoms";
import { getPublicCompetitionInfo } from "@/lib/competition";
import { getEventName, getEvents } from "@/lib/events";
import { publicH2hPath, publicH2hQuery } from "@/lib/h2hPublic";
import { QueryError } from "@/lib/queryCache";
import { socket } from "@/socket";

/**
 * One head-to-head match for the projector: both competitors, their sets
 * and points, and their station timers live. Runs outside the public
 * layout, like the TV view, so nothing else is on screen.
 */
const PublicH2hMatch = () => {
    const { roundId = "", matchNumber = "" } = useParams<{
        roundId: string;
        matchNumber: string;
    }>();
    const [competition, setCompetition] = useAtom(competitionAtom);
    const [isLive, setIsLive] = useState(socket.connected);
    const query = publicH2hQuery(roundId);
    const {
        data: view,
        error,
        refetch,
    } = useLiveQuery(query, {
        enabled: !!roundId,
    });
    const stations = useLiveStations();
    useRefetchOnReconnect();
    useSocketRoom(roundId ? "H2h" : null, {
        params: { roundId },
        invalidateOn: { h2hUpdated: [query.key] },
    });

    useEffect(() => {
        Promise.all([getPublicCompetitionInfo(), getEvents()]).then(
            ([response]) => {
                if (response.status === 200) setCompetition(response.data);
            }
        );
    }, [setCompetition]);

    // This page runs its own connection, outside the layouts
    useEffect(() => {
        const handleConnect = () => setIsLive(true);
        const handleDisconnect = () => setIsLive(false);
        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);
        socket.connect();
        return () => {
            socket.off("connect", handleConnect);
            socket.off("disconnect", handleDisconnect);
            socket.disconnect();
        };
    }, []);

    const match = view?.matches.find(
        (m) => String(m.matchNumber) === matchNumber
    );
    useDocumentTitle(match?.label ?? "Scoreboard", competition?.name);
    useWakeLock();
    const eventId = roundId.split("-r")[0];

    return (
        <div className="min-h-dvh bg-background">
            <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-6 py-6 min-[760px]:px-10 min-[760px]:py-8">
                <header className="flex flex-wrap items-center gap-4">
                    <Link
                        to={publicH2hPath(roundId)}
                        className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                    >
                        <ChevronLeft className="size-4" />
                        Bracket
                    </Link>
                    <p className="min-w-0 flex-1 truncate text-lg font-semibold text-muted-foreground">
                        {competition?.name}
                        {competition &&
                            ` · ${getEventName(eventId)} · Round ${roundId.split("-r")[1]}`}
                    </p>
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <StatusDot
                            tone={isLive ? "success" : "neutral"}
                            className="size-2"
                        />
                        {isLive ? "Live" : "Reconnecting"}
                    </span>
                </header>
                {view && match ? (
                    <H2hScoreboard
                        key={match.id}
                        view={view}
                        match={match}
                        stations={stations}
                    />
                ) : error instanceof QueryError && error.status === 404 ? (
                    <EmptyState>
                        The bracket for this round isn't ready yet.
                    </EmptyState>
                ) : view ? (
                    <EmptyState>
                        There's no such match in this round.
                    </EmptyState>
                ) : error ? (
                    <RequestError onRetry={() => void refetch()} />
                ) : (
                    <SectionLoading label="Loading the match" />
                )}
            </div>
        </div>
    );
};

export default PublicH2hMatch;
