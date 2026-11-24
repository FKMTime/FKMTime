import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import FlagIcon from "@/Components/Icons/FlagIcon";
import { StatusBadge } from "@/Components/shared/StatusBadge";
import { Button } from "@/Components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/Components/ui/dialog";
import { H2hSideName } from "@/lib/h2h";
import {
    BracketLayout,
    entrantOf,
    h2hTimeText,
    layoutBracket,
    matchEndText,
    matchFormatText,
    PublicH2hAttempt,
    PublicH2hMatch,
    PublicH2hView,
    publicScoreboardPath,
    setPoints,
    setScoresText,
    sideOf,
    slotText,
} from "@/lib/h2hPublic";
import { cn } from "@/lib/utils";

const COLUMN_WIDTH = 232;
const COLUMN_GAP = 40;
const HEADER_HEIGHT = 32;

const SideRow = ({
    view,
    match,
    side,
}: {
    view: PublicH2hView;
    match: PublicH2hMatch;
    side: H2hSideName;
}) => {
    const slot = sideOf(match, side);
    const entrant = entrantOf(view, slot);
    const finished = match.status === "FINISHED";
    const isWinner = finished && match.winnerSide === side;
    const isLoser = finished && match.winnerSide !== null && !isWinner;
    const showScore =
        match.status === "IN_PROGRESS" ||
        (finished && match.endedBy !== "WALKOVER");
    return (
        <div
            data-result={isWinner ? "winner" : isLoser ? "loser" : undefined}
            className={cn(
                "flex items-center gap-2 text-sm",
                isWinner && "font-bold",
                isLoser && "text-muted-foreground"
            )}
        >
            <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {entrant?.seed ?? ""}
            </span>
            {entrant?.countryIso2 && (
                <FlagIcon
                    country={entrant.countryIso2}
                    size={14}
                    withTooltip={false}
                />
            )}
            <span
                className={cn(
                    "min-w-0 flex-1 truncate",
                    !entrant && "italic text-muted-foreground"
                )}
            >
                {slotText(view, slot)}
            </span>
            {showScore && (
                <span className="shrink-0 tabular-nums">
                    {side === "A" ? match.score.a : match.score.b}
                </span>
            )}
        </div>
    );
};

interface MatchCardProps {
    view: PublicH2hView;
    match: PublicH2hMatch;
    onOpen: (match: PublicH2hMatch) => void;
    className?: string;
}

/** Two rows, seed, flag, name and sets won; opens the point-by-point times */
export const MatchCard = ({
    view,
    match,
    onOpen,
    className,
}: MatchCardProps) => {
    const isPlaying = match.status === "IN_PROGRESS";
    const endText = matchEndText(view, match);
    return (
        <article
            aria-label={match.label}
            aria-current={isPlaying ? "true" : undefined}
            className={cn(
                "rounded-lg border bg-card shadow-xs",
                isPlaying && "border-primary ring-2 ring-primary",
                className
            )}
        >
            <button
                type="button"
                onClick={() => onOpen(match)}
                className="flex w-full flex-col gap-1 rounded-lg p-2 text-left hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                <span className="flex items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
                    {match.label}
                    {isPlaying && (
                        <StatusBadge tone="primary" withDot>
                            Playing
                        </StatusBadge>
                    )}
                </span>
                <SideRow view={view} match={match} side="A" />
                <SideRow view={view} match={match} side="B" />
                {match.status === "FINISHED" && match.sets.length > 0 && (
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                        {setScoresText(match)}
                    </span>
                )}
                {endText && (
                    <span className="text-[11px] text-muted-foreground">
                        {endText}
                    </span>
                )}
            </button>
        </article>
    );
};

const TimeCell = ({
    attempt,
    won,
}: {
    attempt: PublicH2hAttempt | null;
    won: boolean;
}) => (
    <td
        className={cn(
            "px-2 py-1.5 text-right tabular-nums",
            won ? "font-bold" : "text-muted-foreground"
        )}
    >
        {attempt ? h2hTimeText(attempt) : "—"}
    </td>
);

/** Every point of a match with both competitors' times */
const MatchDetails = ({
    view,
    match,
    onClose,
}: {
    view: PublicH2hView;
    match: PublicH2hMatch | null;
    onClose: () => void;
}) => {
    const nameOf = (side: H2hSideName) =>
        match ? slotText(view, sideOf(match, side)) : "";
    return (
        <Dialog
            open={match !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            {match && (
                <DialogContent className="max-h-[90dvh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{match.label}</DialogTitle>
                        <DialogDescription>
                            {matchFormatText(match.setsToWin)}
                        </DialogDescription>
                    </DialogHeader>
                    {matchEndText(view, match) && (
                        <p className="text-sm">{matchEndText(view, match)}</p>
                    )}
                    {match.sets.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            {match.status === "FINISHED"
                                ? "No points were played."
                                : "Not started yet."}
                        </p>
                    ) : (
                        match.sets.map((set) => {
                            const { a, b } = setPoints(set);
                            return (
                                <section
                                    key={set.setNumber}
                                    aria-label={`Set ${set.setNumber}`}
                                    className="flex flex-col gap-1"
                                >
                                    <h3 className="text-sm font-semibold">
                                        Set {set.setNumber} · {a}–{b}
                                        {set.winnerSide &&
                                            ` · ${nameOf(set.winnerSide)} won`}
                                    </h3>
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-xs text-muted-foreground">
                                                <th className="w-16 py-1 text-left font-semibold">
                                                    Point
                                                </th>
                                                <th className="truncate px-2 py-1 text-right font-semibold">
                                                    {nameOf("A")}
                                                </th>
                                                <th className="truncate px-2 py-1 text-right font-semibold">
                                                    {nameOf("B")}
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {set.points.map((point) => (
                                                <tr
                                                    key={point.pointNumber}
                                                    className="border-t"
                                                >
                                                    <td className="py-1.5 text-muted-foreground">
                                                        {point.pointNumber}
                                                        {point.extraGranted && (
                                                            <span className="block text-[11px]">
                                                                Extra granted
                                                            </span>
                                                        )}
                                                    </td>
                                                    <TimeCell
                                                        attempt={point.a}
                                                        won={
                                                            point.winnerSide ===
                                                            "A"
                                                        }
                                                    />
                                                    <TimeCell
                                                        attempt={point.b}
                                                        won={
                                                            point.winnerSide ===
                                                            "B"
                                                        }
                                                    />
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </section>
                            );
                        })
                    )}
                    <Button asChild variant="outline" className="self-start">
                        <Link
                            to={publicScoreboardPath(
                                view.roundId,
                                match.matchNumber
                            )}
                        >
                            Open scoreboard
                        </Link>
                    </Button>
                </DialogContent>
            )}
        </Dialog>
    );
};

/** Stages as columns with lines from each match to the one it feeds */
const WideBracket = ({
    view,
    layout,
    slotHeight,
    onOpen,
}: {
    view: PublicH2hView;
    layout: BracketLayout;
    slotHeight: number;
    onOpen: (match: PublicH2hMatch) => void;
}) => {
    const width =
        layout.columns.length * COLUMN_WIDTH +
        Math.max(0, layout.columns.length - 1) * COLUMN_GAP;
    const height = layout.height * slotHeight;
    const left = (column: number) => column * (COLUMN_WIDTH + COLUMN_GAP);
    const placed = [
        ...layout.matches,
        ...(layout.thirdPlace ? [layout.thirdPlace] : []),
    ];
    return (
        <div className="relative" style={{ width }}>
            <div className="flex" style={{ gap: COLUMN_GAP }}>
                {layout.columns.map((column) => (
                    <h2
                        key={column.stage}
                        className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                        style={{ width: COLUMN_WIDTH, height: HEADER_HEIGHT }}
                    >
                        {column.label}
                    </h2>
                ))}
            </div>
            <div className="relative" style={{ height }}>
                <svg
                    aria-hidden
                    className="pointer-events-none absolute inset-0 text-border-strong"
                    width={width}
                    height={height}
                >
                    {layout.connectors.map((line) => {
                        const x1 = left(line.fromColumn) + COLUMN_WIDTH;
                        const x2 = left(line.fromColumn + 1);
                        const mid = x1 + COLUMN_GAP / 2;
                        return (
                            <path
                                key={`${line.from}-${line.to}`}
                                data-connector={`${line.from}-${line.to}`}
                                d={`M ${x1} ${line.fromY * slotHeight} H ${mid} V ${line.toY * slotHeight} H ${x2}`}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={1.5}
                            />
                        );
                    })}
                </svg>
                {placed.map(({ match, column, y }) => (
                    <div
                        key={match.id}
                        className="absolute -translate-y-1/2"
                        style={{
                            left: left(column),
                            top: y * slotHeight,
                            width: COLUMN_WIDTH,
                        }}
                    >
                        <MatchCard view={view} match={match} onOpen={onOpen} />
                    </div>
                ))}
            </div>
        </div>
    );
};

/** The stage to open first on a phone: the one being played, or still to come */
const firstStageIndex = (layout: BracketLayout) => {
    const columnOf = (pick: (match: PublicH2hMatch) => boolean) => {
        const all = [
            ...layout.matches,
            ...(layout.thirdPlace ? [layout.thirdPlace] : []),
        ];
        const found = all
            .filter((p) => pick(p.match))
            .sort((x, y) => x.match.matchNumber - y.match.matchNumber)[0];
        return found?.column;
    };
    return (
        columnOf((m) => m.status === "IN_PROGRESS") ??
        columnOf((m) => m.status !== "FINISHED") ??
        Math.max(0, layout.columns.length - 1)
    );
};

/** One stage per screen, with stage tabs; swiping moves between stages */
const NarrowBracket = ({
    view,
    layout,
    onOpen,
}: {
    view: PublicH2hView;
    layout: BracketLayout;
    onOpen: (match: PublicH2hMatch) => void;
}) => {
    const [active, setActive] = useState(() => firstStageIndex(layout));
    const scroller = useRef<HTMLDivElement>(null);
    const startAt = useRef(active);

    useEffect(() => {
        const element = scroller.current;
        if (element) element.scrollLeft = startAt.current * element.clientWidth;
    }, []);

    const show = (index: number) => {
        setActive(index);
        const element = scroller.current;
        element?.scrollTo?.({
            left: index * element.clientWidth,
            behavior: "smooth",
        });
    };
    const onScroll = () => {
        const element = scroller.current;
        if (!element || element.clientWidth === 0) return;
        const index = Math.round(element.scrollLeft / element.clientWidth);
        if (index !== active) setActive(index);
    };

    return (
        <div className="flex flex-col gap-3">
            <div
                role="tablist"
                aria-label="Stages"
                className="flex gap-1 overflow-x-auto"
            >
                {layout.columns.map((column, index) => (
                    <button
                        key={column.stage}
                        type="button"
                        role="tab"
                        aria-selected={index === active}
                        onClick={() => show(index)}
                        className={cn(
                            "h-9 shrink-0 rounded-full px-3 text-sm font-semibold",
                            index === active
                                ? "bg-primary-soft text-primary"
                                : "text-muted-foreground"
                        )}
                    >
                        {column.label}
                    </button>
                ))}
            </div>
            <div
                ref={scroller}
                onScroll={onScroll}
                className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
            >
                {layout.columns.map((column, index) => {
                    const inColumn = layout.matches
                        .filter((p) => p.column === index)
                        .sort((x, y) => x.y - y.y);
                    const third =
                        layout.thirdPlace?.column === index
                            ? layout.thirdPlace
                            : null;
                    return (
                        <section
                            key={column.stage}
                            role="tabpanel"
                            aria-label={column.label}
                            className="flex w-full shrink-0 snap-start flex-col gap-2 px-0.5"
                        >
                            {inColumn.map(({ match }) => (
                                <MatchCard
                                    key={match.id}
                                    view={view}
                                    match={match}
                                    onOpen={onOpen}
                                />
                            ))}
                            {third && (
                                <MatchCard
                                    view={view}
                                    match={third.match}
                                    onOpen={onOpen}
                                    className="mt-3"
                                />
                            )}
                        </section>
                    );
                })}
            </div>
        </div>
    );
};

interface H2hBracketProps {
    view: PublicH2hView;
    /** Height of one first-stage match, in px */
    slotHeight?: number;
    /** Off on the TV, where a phone never looks */
    narrow?: boolean;
    /** Shrinks the bracket to fit this box, in px, e.g. on the TV */
    fit?: { width: number; height: number };
}

/**
 * A head-to-head bracket for spectators: stages left to right with the
 * match in play highlighted; on phones, one stage per screen
 */
const H2hBracket = ({
    view,
    slotHeight = 124,
    narrow = true,
    fit,
}: H2hBracketProps) => {
    const layout = layoutBracket(view);
    const columns = layout.columns.length;
    const zoom = fit
        ? Math.min(
              1,
              fit.width /
                  (columns * COLUMN_WIDTH +
                      Math.max(0, columns - 1) * COLUMN_GAP),
              fit.height / (HEADER_HEIGHT + layout.height * slotHeight)
          )
        : 1;
    const [open, setOpen] = useState<number | null>(null);
    // Kept by number, so a live update shows the new times in the dialog
    const openMatch =
        view.matches.find((match) => match.matchNumber === open) ?? null;
    const onOpen = (match: PublicH2hMatch) => setOpen(match.matchNumber);

    return (
        <>
            <div
                className={cn(
                    "overflow-x-auto pb-2",
                    narrow && "hidden min-[760px]:block"
                )}
                style={zoom < 1 ? { zoom } : undefined}
            >
                <WideBracket
                    view={view}
                    layout={layout}
                    slotHeight={slotHeight}
                    onOpen={onOpen}
                />
            </div>
            {narrow && (
                <div className="min-[760px]:hidden">
                    <NarrowBracket
                        view={view}
                        layout={layout}
                        onOpen={onOpen}
                    />
                </div>
            )}
            <MatchDetails
                view={view}
                match={openMatch}
                onClose={() => setOpen(null)}
            />
        </>
    );
};

export default H2hBracket;
