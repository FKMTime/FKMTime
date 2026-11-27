import { useQuery } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { Maximize } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import H2hBracket from "@/Components/h2h/H2hBracket";
import H2hScoreboard from "@/Components/h2h/H2hScoreboard";
import LoadingPage from "@/Components/LoadingPage";
import LiveSolvingBoard from "@/Components/shared/LiveSolvingBoard";
import { StatusDot } from "@/Components/shared/StatusBadge";
import { Button } from "@/Components/ui/button";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useRefetchOnReconnect } from "@/hooks/useRefetchOnReconnect";
import { useSocketEvents } from "@/hooks/useSocketEvents";
import { useSocketRoom } from "@/hooks/useSocketRoom";
import { useWakeLock } from "@/hooks/useWakeLock";
import { competitionAtom } from "@/lib/atoms";
import { getPublicCompetitionInfo, publicRoomsQuery } from "@/lib/competition";
import { getEventIconClass, getEventName, getEvents } from "@/lib/events";
import { publicH2hQuery } from "@/lib/h2hPublic";
import { StationInfo } from "@/lib/liveSolving";
import {
    getFollowedH2hRoundId,
    getTvH2hRounds,
    getTvSlides,
    getTvZoom,
    stepSlide,
    TV_SLIDE_MS,
} from "@/lib/publicTv";
import { QueryError, toQueryOptions } from "@/lib/queryCache";
import { publicRoundResultsQuery } from "@/lib/results";
import { formatClockTime, formatElapsed } from "@/lib/time";
import { cn } from "@/lib/utils";
import { socket } from "@/socket";

import { getH2hRoundIds } from "../publicNavigation";
import TvResultsSlide from "./TvResultsSlide";

const ROOMS_REFRESH_MS = 60_000;
const CONTROLS_HIDE_MS = 3_000;

/**
 * Venue TV / projector view: fullscreen, large type, rotating between live
 * solving and the top of each round in progress. Nothing to click.
 */
const PublicTv = () => {
    const [competition, setCompetition] = useAtom(competitionAtom);
    // Polled as well as refetched on reconnect, in case a group change
    // was missed
    const { data: roomsData, dataUpdatedAt: roomsUpdatedAt } = useQuery({
        ...toQueryOptions(publicRoomsQuery),
        refetchInterval: ROOMS_REFRESH_MS,
    });
    const rooms = useMemo(() => roomsData ?? [], [roomsData]);
    const [stations, setStations] = useState<Map<number, StationInfo>>(
        new Map()
    );
    const [slideIndex, setSlideIndex] = useState(0);
    const [isLive, setIsLive] = useState(socket.connected);
    const [stationsUpdatedAt, setStationsUpdatedAt] = useState(() =>
        Date.now()
    );
    const [now, setNow] = useState(new Date());
    const [zoom, setZoom] = useState(() =>
        getTvZoom(window.innerWidth, window.innerHeight)
    );
    const [showControls, setShowControls] = useState(true);

    const liveRoundIds = useMemo(
        () => [
            ...new Set(
                rooms.flatMap((room) =>
                    room.currentGroupIds.map((id) => id.split("-g")[0])
                )
            ),
        ],
        [rooms]
    );
    // A head-to-head round in progress: its bracket, or the match on stage.
    // One at a time, as a venue runs one such round at once.
    const h2hRoundIds = useMemo(
        () => getH2hRoundIds(competition?.wcif),
        [competition]
    );
    const h2hRoundId = getFollowedH2hRoundId(liveRoundIds, h2hRoundIds);
    const h2hQuery = publicH2hQuery(h2hRoundId ?? "");
    const {
        data: h2hView,
        dataUpdatedAt: h2hUpdatedAt,
        error: h2hError,
        refetch: refetchH2h,
    } = useLiveQuery(h2hQuery, { enabled: !!h2hRoundId });
    const h2hRounds = useMemo(
        () => getTvH2hRounds(h2hRoundId, h2hView),
        [h2hRoundId, h2hView]
    );
    // Nobody is at the TV to press retry: a bracket that failed to load
    // (or isn't created yet) is fetched again until it comes
    useEffect(() => {
        if (!h2hError) return;
        const retry = setInterval(() => void refetchH2h(), ROOMS_REFRESH_MS);
        return () => clearInterval(retry);
    }, [h2hError, refetchH2h]);
    const slides = useMemo(
        () => getTvSlides(liveRoundIds, h2hRounds, h2hRoundIds),
        [liveRoundIds, h2hRounds, h2hRoundIds]
    );
    // When the matches stop (or start), the rotation starts over, so the
    // bracket is what comes up when a match ends
    const isMatchPlaying = slides[0]?.type === "h2hMatch";
    const [shownPlaying, setShownPlaying] = useState(isMatchPlaying);
    if (shownPlaying !== isMatchPlaying) {
        setShownPlaying(isMatchPlaying);
        setSlideIndex(0);
    }
    const slide = slides[stepSlide(slideIndex, slides.length, 0)];
    const roundId = slide.type === "results" ? slide.roundId : null;

    // Competition, event names and the rooms running each round
    useEffect(() => {
        Promise.all([getPublicCompetitionInfo(), getEvents()]).then(
            ([response]) => {
                if (response.status === 200) setCompetition(response.data);
            }
        );
    }, [setCompetition]);

    // Results for the round on screen, keyed by round so a slide never
    // shows another round's results
    const resultsQuery = publicRoundResultsQuery(roundId ?? "");
    const { data: results, dataUpdatedAt: resultsUpdatedAt } = useLiveQuery(
        resultsQuery,
        { enabled: !!roundId }
    );

    // This page runs its own connection, outside the layouts, so it also
    // refetches on reconnect itself. The rooms are joined again on every
    // connect.
    useRefetchOnReconnect();
    useSocketRoom("LiveSolving");
    useSocketRoom(roundId ? "Results" : null, {
        params: { roundId: roundId ?? "" },
        invalidateOn: { resultEntered: [resultsQuery.key] },
    });
    useSocketRoom(h2hRoundId ? "H2h" : null, {
        params: { roundId: h2hRoundId ?? "" },
        invalidateOn: { h2hUpdated: [h2hQuery.key] },
    });
    useSocketEvents({
        currentStations: (data) => {
            setStations(
                new Map((data as StationInfo[]).map((s) => [s.espId, s]))
            );
            setStationsUpdatedAt(Date.now());
        },
        currentTimeInfo: (data) => {
            const station = data as StationInfo;
            setStations((prev) => new Map(prev).set(station.espId, station));
            setStationsUpdatedAt(Date.now());
        },
    });

    // The socket also tells us when we're offline
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

    // The newest of anything that arrived: stations, rooms or results
    const lastUpdate = new Date(
        Math.max(
            stationsUpdatedAt,
            roomsUpdatedAt,
            resultsUpdatedAt,
            h2hUpdatedAt
        )
    );

    // Rotation, clock, arrow keys and screen size
    useEffect(() => {
        const rotate = setInterval(
            () => setSlideIndex((i) => stepSlide(i, slides.length)),
            TV_SLIDE_MS
        );
        return () => clearInterval(rotate);
        // Restarted when the matches start or stop too, so the first slide
        // after that gets its full time
    }, [slides.length, isMatchPlaying]);

    useEffect(() => {
        const tick = setInterval(() => setNow(new Date()), 15_000);
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "ArrowRight")
                setSlideIndex((i) => stepSlide(i, slides.length));
            if (event.key === "ArrowLeft")
                setSlideIndex((i) => stepSlide(i, slides.length, -1));
        };
        const onResize = () =>
            setZoom(getTvZoom(window.innerWidth, window.innerHeight));
        window.addEventListener("keydown", onKey);
        window.addEventListener("resize", onResize);
        return () => {
            clearInterval(tick);
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("resize", onResize);
        };
    }, [slides.length]);

    // The fullscreen button and cursor hide once the mouse is still
    useEffect(() => {
        let timeout = setTimeout(
            () => setShowControls(false),
            CONTROLS_HIDE_MS
        );
        const onMove = () => {
            setShowControls(true);
            clearTimeout(timeout);
            timeout = setTimeout(
                () => setShowControls(false),
                CONTROLS_HIDE_MS
            );
        };
        window.addEventListener("mousemove", onMove);
        return () => {
            clearTimeout(timeout);
            window.removeEventListener("mousemove", onMove);
        };
    }, []);

    // Fixed rather than per slide, so the tab doesn't flicker every rotation
    useDocumentTitle("TV", competition?.name);
    // Nobody touches the machine driving the screen, so keep it awake
    useWakeLock();

    if (!competition) return <LoadingPage />;

    const eventId = slide.type === "live" ? "" : slide.roundId.split("-r")[0];
    const h2hMatch =
        slide.type === "h2hMatch"
            ? h2hView?.matches.find((m) => m.matchNumber === slide.matchNumber)
            : undefined;
    const title =
        slide.type === "live"
            ? "Live solving"
            : `${getEventName(eventId)} · Round ${slide.roundId.split("-r")[1]}`;

    return (
        <div
            className={cn(
                "min-h-dvh overflow-hidden bg-background",
                !showControls && "cursor-none"
            )}
        >
            <div
                style={{ zoom }}
                className="mx-auto flex min-h-[720px] max-w-[1280px] flex-col gap-6 px-10 py-8"
            >
                <header className="flex items-center gap-6">
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-semibold text-muted-foreground">
                            {competition.name}
                        </p>
                        <h1 className="flex items-center gap-3 text-4xl font-bold tracking-[-0.02em]">
                            {eventId && (
                                <span
                                    aria-hidden
                                    className={cn(
                                        "cubing-icon",
                                        getEventIconClass(eventId)
                                    )}
                                />
                            )}
                            {title}
                        </h1>
                    </div>
                    {!isLive && (
                        <span
                            role="status"
                            className="flex items-center gap-2 rounded-full bg-warning-soft px-4 py-2 text-lg font-semibold text-warning"
                        >
                            <StatusDot tone="warning" className="size-2.5" />
                            Reconnecting · updated{" "}
                            {formatElapsed(lastUpdate, now) === "now"
                                ? "just now"
                                : `${formatElapsed(lastUpdate, now)} ago`}
                        </span>
                    )}
                    <div className="flex items-center gap-1.5" aria-hidden>
                        {slides.map((_, index) => (
                            <span
                                key={index}
                                className={cn(
                                    "size-2.5 rounded-full",
                                    index ===
                                        stepSlide(slideIndex, slides.length, 0)
                                        ? "bg-primary"
                                        : "bg-border-strong"
                                )}
                            />
                        ))}
                    </div>
                    <span className="text-3xl font-bold tabular-nums">
                        {formatClockTime(now)}
                    </span>
                </header>

                {slide.type === "h2hMatch" ? (
                    h2hView &&
                    h2hMatch && (
                        <H2hScoreboard
                            // A fresh scoreboard per match: nothing of the
                            // last one may light up or time this one
                            key={h2hMatch.id}
                            view={h2hView}
                            match={h2hMatch}
                            stations={Array.from(stations.values())}
                        />
                    )
                ) : slide.type === "h2hBracket" ? (
                    h2hView?.roundId === slide.roundId ? (
                        <H2hBracket
                            view={h2hView}
                            narrow={false}
                            fit={{ width: 1200, height: 560 }}
                        />
                    ) : (
                        <p className="py-24 text-center text-3xl text-muted-foreground">
                            {h2hError instanceof QueryError &&
                            h2hError.status === 404
                                ? "The bracket for this round isn't ready yet."
                                : h2hError
                                  ? "Couldn't load the bracket. Trying again…"
                                  : "Loading the bracket…"}
                        </p>
                    )
                ) : slide.type === "live" ? (
                    <div className="[&_h2]:text-2xl">
                        <LiveSolvingBoard
                            stations={Array.from(stations.values())}
                            rooms={rooms}
                            allRoomsLabel="All rooms"
                            showRoomFilter={false}
                        />
                    </div>
                ) : (
                    <TvResultsSlide
                        wcif={competition.wcif}
                        roundId={slide.roundId}
                        results={results ?? null}
                    />
                )}
            </div>

            {showControls && !document.fullscreenElement && (
                <Button
                    variant="outline"
                    className="fixed bottom-6 right-6"
                    onClick={() => document.documentElement.requestFullscreen()}
                >
                    <Maximize />
                    Fullscreen
                </Button>
            )}
        </div>
    );
};

export default PublicTv;
