import { useEffect, useState } from "react";

import FlagIcon from "@/Components/Icons/FlagIcon";
import useStationTimer from "@/hooks/useStationTimer";
import { H2hSideName } from "@/lib/h2h";
import {
    entrantOf,
    h2hTimeText,
    lastDecidedPoint,
    latestPoint,
    matchFormatText,
    matchOutcome,
    PointMarker,
    pointMarkers,
    PublicH2hMatch,
    PublicH2hView,
    sideOf,
    slotText,
    stationOf,
} from "@/lib/h2hPublic";
import { StationInfo } from "@/lib/liveSolving";
import { centisecondsToClockFormat } from "@/lib/resultFormatters";
import { cn } from "@/lib/utils";

/** How long the winner of a point stays lit up */
export const POINT_LIT_MS = 5_000;

const MARKER_TEXT: Record<PointMarker, string> = {
    won: "won",
    lost: "lost",
    none: "no winner",
    pending: "not played yet",
};

const MARKER_CLASS: Record<PointMarker, string> = {
    won: "bg-success border-success",
    lost: "bg-destructive/70 border-destructive/70",
    none: "border-dashed border-muted-foreground bg-transparent",
    pending: "border-border-strong bg-transparent",
};

const formatCs = (cs: number) => {
    try {
        return centisecondsToClockFormat(Math.max(0, cs));
    } catch {
        return "0.00";
    }
};

/** The competitor's station timer while it runs, else their last time */
const SideTime = ({
    station,
    lastTime,
}: {
    station: StationInfo | null;
    lastTime: string | null;
}) =>
    station ? (
        <StationTime station={station} lastTime={lastTime} />
    ) : (
        <TimeText text={lastTime} live={false} />
    );

const StationTime = ({
    station,
    lastTime,
}: {
    station: StationInfo;
    lastTime: string | null;
}) => {
    const { phase, displayTime, displayInspection } = useStationTimer(station);
    if (phase === "solving" && displayTime !== null) {
        return <TimeText text={formatCs(displayTime)} live />;
    }
    if (phase === "inspection" && displayInspection !== null) {
        return <TimeText text={formatCs(displayInspection)} live />;
    }
    return <TimeText text={lastTime} live={false} />;
};

const TimeText = ({ text, live }: { text: string | null; live: boolean }) => (
    <p
        data-live={live ? "true" : undefined}
        className={cn(
            "font-mono text-5xl font-bold tabular-nums",
            live ? "text-primary" : "text-foreground",
            text === null && "text-muted-foreground"
        )}
    >
        {text ?? "—"}
    </p>
);

const SidePanel = ({
    view,
    match,
    side,
    station,
    isLit,
}: {
    view: PublicH2hView;
    match: PublicH2hMatch;
    side: H2hSideName;
    station: StationInfo | null;
    isLit: boolean;
}) => {
    const slot = sideOf(match, side);
    const entrant = entrantOf(view, slot);
    const point = latestPoint(match);
    const attempt = point ? (side === "A" ? point.a : point.b) : null;
    const isWinner = match.status === "FINISHED" && match.winnerSide === side;
    const isLoser =
        match.status === "FINISHED" && match.winnerSide !== null && !isWinner;
    return (
        <section
            aria-label={slotText(view, slot)}
            data-lit={isLit ? "true" : undefined}
            className={cn(
                "flex flex-col gap-5 rounded-2xl border bg-card p-6 transition-colors duration-300",
                isLit && "border-success bg-success-soft ring-4 ring-success",
                isLoser && "opacity-60"
            )}
        >
            <div className="flex items-center gap-3">
                {entrant && (
                    <span className="text-xl font-semibold tabular-nums text-muted-foreground">
                        {entrant.seed}
                    </span>
                )}
                {entrant?.countryIso2 && (
                    <FlagIcon country={entrant.countryIso2} size={32} />
                )}
                <h2
                    className={cn(
                        "min-w-0 flex-1 truncate text-3xl font-bold",
                        !entrant && "italic text-muted-foreground"
                    )}
                >
                    {slotText(view, slot)}
                </h2>
            </div>
            <div className="flex items-end justify-between gap-4">
                <p
                    aria-label="Sets won"
                    className="text-8xl font-bold leading-none tabular-nums"
                >
                    {side === "A" ? match.score.a : match.score.b}
                </p>
                <SideTime
                    station={station}
                    lastTime={attempt ? h2hTimeText(attempt) : null}
                />
            </div>
            <div className="flex flex-col gap-2">
                {match.sets.map((set) => (
                    <div
                        key={set.setNumber}
                        className="flex items-center gap-3"
                    >
                        <span className="w-14 shrink-0 text-sm font-semibold text-muted-foreground">
                            Set {set.setNumber}
                        </span>
                        <ol
                            aria-label={`Set ${set.setNumber}`}
                            className="flex flex-wrap gap-1.5"
                        >
                            {pointMarkers(set, side).map((marker, index) => (
                                <li
                                    key={index}
                                    aria-label={`Point ${index + 1}: ${MARKER_TEXT[marker]}`}
                                    data-marker={marker}
                                    className={cn(
                                        "size-5 rounded-full border-2",
                                        MARKER_CLASS[marker]
                                    )}
                                />
                            ))}
                        </ol>
                    </div>
                ))}
            </div>
        </section>
    );
};

/**
 * Which side won the point just decided, while it stays lit up. Nothing
 * lights up for what was already decided when the scoreboard opened.
 */
const useLitSide = (match: PublicH2hMatch) => {
    const last = lastDecidedPoint(match);
    const key = last
        ? `${match.matchNumber}-${last.setNumber}-${last.point.pointNumber}`
        : null;
    const [lit, setLit] = useState<{
        key: string | null;
        side: H2hSideName | null;
    }>({ key, side: null });
    if (lit.key !== key) {
        setLit({ key, side: last?.point.winnerSide ?? null });
    }
    useEffect(() => {
        if (!lit.side) return;
        const timeout = setTimeout(
            () => setLit((current) => ({ ...current, side: null })),
            POINT_LIT_MS
        );
        return () => clearTimeout(timeout);
    }, [lit]);
    return lit.side;
};

interface H2hScoreboardProps {
    view: PublicH2hView;
    match: PublicH2hMatch;
    /** Live stations, whose timers show for the competitors at them */
    stations: StationInfo[];
}

/** One match for the projector: both competitors side by side */
const H2hScoreboard = ({ view, match, stations }: H2hScoreboardProps) => {
    const litSide = useLitSide(match);
    const outcome = matchOutcome(view, match);
    const stationFor = (side: H2hSideName) =>
        match.status === "IN_PROGRESS"
            ? stationOf(
                  stations,
                  entrantOf(view, sideOf(match, side))?.registrantId ?? null
              )
            : null;
    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="text-4xl font-bold">{match.label}</h2>
                <p className="text-xl text-muted-foreground">
                    {matchFormatText(match.setsToWin)}
                </p>
            </div>
            {outcome && (
                <div
                    role="status"
                    className="flex flex-col items-center gap-1 rounded-2xl bg-success-soft px-6 py-5 text-center text-success"
                >
                    <p className="text-4xl font-bold">
                        {outcome.winnerName} {outcome.how}
                    </p>
                    {outcome.next && (
                        <p className="text-xl font-semibold">{outcome.next}</p>
                    )}
                </div>
            )}
            {match.status === "WAITING" || match.status === "READY" ? (
                <p className="text-xl text-muted-foreground">
                    {match.status === "READY"
                        ? "Starts soon"
                        : "Waiting for earlier matches"}
                </p>
            ) : null}
            <div className="grid grid-cols-2 gap-6">
                {(["A", "B"] as const).map((side) => (
                    <SidePanel
                        key={side}
                        view={view}
                        match={match}
                        side={side}
                        station={stationFor(side)}
                        isLit={litSide === side}
                    />
                ))}
            </div>
        </div>
    );
};

export default H2hScoreboard;
