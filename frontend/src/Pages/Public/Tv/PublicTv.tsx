import { useAtom } from "jotai";
import { Maximize } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import LoadingPage from "@/Components/LoadingPage";
import LiveSolvingBoard from "@/Components/shared/LiveSolvingBoard";
import { StatusDot } from "@/Components/shared/StatusBadge";
import { Button } from "@/Components/ui/button";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { competitionAtom } from "@/lib/atoms";
import { getPublicCompetitionInfo, getPublicRooms } from "@/lib/competition";
import { getEventIconClass, getEventName, getEvents } from "@/lib/events";
import { Result, Room } from "@/lib/interfaces";
import { StationInfo } from "@/lib/liveSolving";
import { getTvSlides, getTvZoom, stepSlide, TV_SLIDE_MS } from "@/lib/publicTv";
import { getPublicResultsByRoundId } from "@/lib/results";
import { formatClockTime, formatElapsed } from "@/lib/time";
import { cn } from "@/lib/utils";
import { socket } from "@/socket";

import TvResultsSlide from "./TvResultsSlide";

const ROOMS_REFRESH_MS = 60_000;
const CONTROLS_HIDE_MS = 3_000;

/**
 * Venue TV / projector view: fullscreen, large type, rotating between live
 * solving and the top of each round in progress. Nothing to click.
 */
const PublicTv = () => {
    const [competition, setCompetition] = useAtom(competitionAtom);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [stations, setStations] = useState<Map<number, StationInfo>>(
        new Map()
    );
    // Results with the round they belong to, so a slide never shows another's
    const [results, setResults] = useState<{
        roundId: string;
        results: Result[];
    } | null>(null);
    const [slideIndex, setSlideIndex] = useState(0);
    const [isLive, setIsLive] = useState(socket.connected);
    const [lastUpdate, setLastUpdate] = useState(new Date());
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
    const slides = useMemo(() => getTvSlides(liveRoundIds), [liveRoundIds]);
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

    const fetchRooms = useCallback(() => {
        getPublicRooms().then((data: Room[]) => {
            setRooms(data ?? []);
            setLastUpdate(new Date());
        });
    }, []);

    useEffect(() => {
        fetchRooms();
        const interval = setInterval(fetchRooms, ROOMS_REFRESH_MS);
        return () => clearInterval(interval);
    }, [fetchRooms]);

    // Live solving over the socket, which also tells us when we're offline
    useEffect(() => {
        const handleConnect = () => {
            setIsLive(true);
            socket.emit("joinLiveSolving");
            fetchRooms();
        };
        const handleDisconnect = () => setIsLive(false);
        const handleStations = (data: StationInfo[]) => {
            setStations(new Map(data.map((s) => [s.espId, s])));
            setLastUpdate(new Date());
        };
        const handleTimeInfo = (data: StationInfo) => {
            setStations((prev) => new Map(prev).set(data.espId, data));
            setLastUpdate(new Date());
        };
        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);
        socket.on("currentStations", handleStations);
        socket.on("currentTimeInfo", handleTimeInfo);
        socket.connect();
        if (socket.connected) handleConnect();
        return () => {
            socket.emit("leaveLiveSolving");
            socket.off("connect", handleConnect);
            socket.off("disconnect", handleDisconnect);
            socket.off("currentStations", handleStations);
            socket.off("currentTimeInfo", handleTimeInfo);
            socket.disconnect();
        };
    }, [fetchRooms]);

    // Results for the round on screen, kept current while it's shown
    useEffect(() => {
        if (!roundId) return;
        const fetchResults = () =>
            getPublicResultsByRoundId(roundId).then((data: Result[]) => {
                setResults({ roundId, results: data });
                setLastUpdate(new Date());
            });
        fetchResults();
        socket.emit("joinResults", { roundId });
        socket.on("resultEntered", fetchResults);
        return () => {
            socket.off("resultEntered", fetchResults);
            socket.emit("leaveResults", { roundId });
        };
    }, [roundId]);

    // Rotation, clock, arrow keys and screen size
    useEffect(() => {
        const rotate = setInterval(
            () => setSlideIndex((i) => stepSlide(i, slides.length)),
            TV_SLIDE_MS
        );
        return () => clearInterval(rotate);
    }, [slides.length]);

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

    if (!competition) return <LoadingPage />;

    const eventId =
        slide.type === "results" ? slide.roundId.split("-r")[0] : "";
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

                {slide.type === "live" ? (
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
                        results={
                            results?.roundId === slide.roundId
                                ? results.results
                                : null
                        }
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
