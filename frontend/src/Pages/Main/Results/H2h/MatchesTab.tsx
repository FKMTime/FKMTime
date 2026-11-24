import { useAtomValue } from "jotai";
import {
    AlertTriangle,
    LogOut,
    Play,
    RotateCcw,
    Undo2,
    UserX,
} from "lucide-react";
import { useState } from "react";
import { getLimitByRoundId } from "wcif-helpers";

import EmptyState from "@/Components/shared/EmptyState";
import RequestError from "@/Components/shared/RequestError";
import SectionLoading from "@/Components/shared/SectionLoading";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useToast } from "@/hooks/useToast";
import { competitionAtom } from "@/lib/atoms";
import { DNF_VALUE, DNS_VALUE } from "@/lib/constants";
import {
    EXTRA_REMINDER,
    grantExtra,
    H2hBracket,
    H2hMatch,
    H2hMatchLogEntry,
    H2hMatchStatus,
    H2hPoint,
    H2hPointAttempt,
    h2hRoundQuery,
    H2hSet,
    H2hSideName,
    invalidateH2hRound,
    MATCH_STATUS_LABELS,
    pointsWon,
    reopenMatch,
    retireFromMatch,
    SET_DECISION_TEXT,
    sideLabel,
    startMatch,
    withdrawFromMatch,
} from "@/lib/h2h";
import { resultToString } from "@/lib/resultFormatters";
import { formatDayTime } from "@/lib/time";
import { cn } from "@/lib/utils";

import CreateAttemptModal from "../Components/CreateAttemptModal";
import MatchActionDialog, { MatchActionDialogProps } from "./MatchActionDialog";

type MatchAction = Omit<MatchActionDialogProps, "onClose">;

/** How a delegate's action on a match reads in its log */
const LOG_TEXT: Record<H2hMatchLogEntry["action"], string> = {
    WITHDRAW: "Withdrew",
    RETIRE: "Retired",
    REOPEN: "Match reopened",
};

const ENDED_TEXT = { WALKOVER: "Walkover", RETIRED: "Retired" } as const;

const STATUS_VARIANT: Record<
    H2hMatchStatus,
    "default" | "success" | "secondary" | "warning"
> = {
    WAITING: "secondary",
    READY: "default",
    IN_PROGRESS: "warning",
    FINISHED: "success",
};

interface Competitor {
    personId: string;
    name: string;
}

const timeText = (attempt: H2hPointAttempt) => {
    if (attempt.penalty === DNF_VALUE) return "DNF";
    if (attempt.penalty === DNS_VALUE) return "DNS";
    return resultToString(attempt.value + Math.max(attempt.penalty, 0) * 100);
};

/** One side's time on a point, or what is missing and a way to enter it */
const Slot = ({
    attempt,
    competitor,
    canEnter,
    onEnter,
}: {
    attempt: H2hPointAttempt | null;
    competitor: Competitor | null;
    canEnter: boolean;
    onEnter: (competitor: Competitor) => void;
}) => {
    if (attempt) {
        return <span className="font-mono">{timeText(attempt)}</span>;
    }
    if (!canEnter || !competitor) {
        return <span className="text-muted-foreground">—</span>;
    }
    return (
        <span className="inline-flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
                Waiting for result
            </span>
            <Button
                size="sm"
                variant="outline"
                onClick={() => onEnter(competitor)}
                aria-label={`Enter ${competitor.name}'s result`}
            >
                Enter
            </Button>
        </span>
    );
};

/** A set's points, one row each, with how the set was decided */
const SetLog = ({
    set,
    names,
    competitors,
    isCurrent,
    onEnter,
    extraPointId,
    onExtra,
}: {
    set: H2hSet;
    names: Record<H2hSideName, string>;
    competitors: Record<H2hSideName, Competitor | null>;
    /** The playing match's open set: missing results can be entered */
    isCurrent: boolean;
    onEnter: (competitor: Competitor) => void;
    /** The point that can get an extra: the last one raced, both results in */
    extraPointId?: string | null;
    onExtra?: (point: H2hPoint) => void;
}) => {
    const won = pointsWon(set);
    const filled = (side: H2hSideName) =>
        set.points.filter((p) =>
            side === "A" ? p.attemptA !== null : p.attemptB !== null
        ).length;
    // A side with a result on every point may start the next one, unless
    // that would put it two points ahead
    const canOpen = (side: H2hSideName) =>
        isCurrent &&
        filled(side) === set.points.length &&
        filled(side) <= filled(side === "A" ? "B" : "A");
    const nextPointNumber =
        (set.points[set.points.length - 1]?.pointNumber ?? 0) + 1;
    return (
        <section
            aria-label={`Set ${set.setNumber}`}
            className="flex flex-col gap-2"
        >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                <span className="font-semibold">
                    Set {set.setNumber} · {won.a}–{won.b}
                </span>
                {set.scrambleSet && (
                    <span className="text-xs text-muted-foreground">
                        Set {set.scrambleSet.set}
                    </span>
                )}
                {set.winnerSide && set.decidedBy && (
                    <span className="text-xs text-muted-foreground">
                        {names[set.winnerSide]}:{" "}
                        {SET_DECISION_TEXT[set.decidedBy]}
                    </span>
                )}
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-16">Point</TableHead>
                        <TableHead>{names.A}</TableHead>
                        <TableHead>{names.B}</TableHead>
                        <TableHead>Point to</TableHead>
                        <TableHead>Scramble</TableHead>
                        {onExtra && <TableHead className="w-0" />}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {set.points.map((point) => (
                        <TableRow key={point.id}>
                            <TableCell>{point.pointNumber}</TableCell>
                            <TableCell>
                                <Slot
                                    attempt={point.attemptA}
                                    competitor={competitors.A}
                                    canEnter={isCurrent}
                                    onEnter={onEnter}
                                />
                            </TableCell>
                            <TableCell>
                                <Slot
                                    attempt={point.attemptB}
                                    competitor={competitors.B}
                                    canEnter={isCurrent}
                                    onEnter={onEnter}
                                />
                            </TableCell>
                            <TableCell>
                                <span className="flex flex-col gap-0.5">
                                    <span>
                                        {!point.decided
                                            ? ""
                                            : point.winnerSide
                                              ? names[point.winnerSide]
                                              : "No winner"}
                                    </span>
                                    {point.afterEnd && (
                                        <span className="text-xs text-muted-foreground">
                                            Doesn't count: raced after the{" "}
                                            {set.winnerSide !== null
                                                ? "set"
                                                : "match"}{" "}
                                            was over
                                        </span>
                                    )}
                                    {point.amendedAfterMatch && (
                                        <span className="text-xs text-warning">
                                            Time amended after the match, winner
                                            unchanged
                                        </span>
                                    )}
                                    {point.extras?.map((race, i) => (
                                        <span
                                            key={i}
                                            className="text-xs text-muted-foreground"
                                        >
                                            Extra granted, replacing{" "}
                                            {timeText(race.attemptA)} and{" "}
                                            {timeText(race.attemptB)}
                                        </span>
                                    ))}
                                </span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                                {point.scramble &&
                                    `Set ${point.scramble.set}, ${point.scramble.isExtra ? "extra" : "scramble"} ${point.scramble.num}`}
                            </TableCell>
                            {onExtra && (
                                <TableCell className="text-right">
                                    {point.id === extraPointId && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => onExtra(point)}
                                            aria-label={`Extra granted on point ${point.pointNumber}`}
                                        >
                                            <RotateCcw className="size-4" />
                                            Extra granted
                                        </Button>
                                    )}
                                </TableCell>
                            )}
                        </TableRow>
                    ))}
                    {isCurrent && (canOpen("A") || canOpen("B")) && (
                        <TableRow>
                            <TableCell>{nextPointNumber}</TableCell>
                            {(["A", "B"] as const).map((side) => (
                                <TableCell key={side}>
                                    <Slot
                                        attempt={null}
                                        competitor={competitors[side]}
                                        canEnter={canOpen(side)}
                                        onEnter={onEnter}
                                    />
                                </TableCell>
                            ))}
                            <TableCell />
                            <TableCell />
                            {onExtra && <TableCell />}
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </section>
    );
};

/**
 * The point an extra can be granted on: the last one raced, with both
 * results in. Earlier points have been followed by others. In a match
 * played to the end, the point that finished it, while nothing the match
 * led to has started.
 */
const extraPointOf = (match: H2hMatch) => {
    const playedOut =
        match.status === "FINISHED" &&
        match.endedBy === "PLAYED" &&
        !match.reopenRefusal;
    if (match.status !== "IN_PROGRESS" && !playedOut) return null;
    const raced = match.sets.filter((set) => set.points.length > 0);
    const last = raced[raced.length - 1]?.points.at(-1);
    // A point raced after the end doesn't count, so it can't be raced again
    return last && last.attemptA && last.attemptB && !last.afterEnd
        ? last
        : null;
};

const MatchCard = ({
    roundId,
    match,
    bracket,
    starting,
    canManage,
    onStart,
    onEnter,
    onAction,
}: {
    roundId: string;
    match: H2hMatch;
    bracket: H2hBracket;
    starting: boolean;
    /** Delegates: manual entry, extras, withdrawals, retiring, reopening */
    canManage: boolean;
    onStart: () => void;
    onEnter: (competitor: Competitor) => void;
    onAction: (action: MatchAction) => void;
}) => {
    const entrantOf = (entrantId: string | null) =>
        bracket.entrants.find((e) => e.id === entrantId) ?? null;
    const competitorOf = (entrantId: string | null): Competitor | null => {
        const entrant = entrantOf(entrantId);
        return entrant
            ? { personId: entrant.person.id, name: entrant.person.name }
            : null;
    };
    const competitors = {
        A: competitorOf(match.sideA.entrantId),
        B: competitorOf(match.sideB.entrantId),
    };
    const names = {
        A: sideLabel(match.sideA, bracket),
        B: sideLabel(match.sideB, bracket),
    };
    const withdrawn = {
        A: !!entrantOf(match.sideA.entrantId)?.withdrawnAt,
        B: !!entrantOf(match.sideB.entrantId)?.withdrawnAt,
    };
    /** "retired" when they stopped during a match, else "withdrew" */
    const leftAs = (side: H2hSideName) => {
        const entrant = entrantOf(
            side === "A" ? match.sideA.entrantId : match.sideB.entrantId
        );
        const leftIn = bracket.matches.find(
            (m) => m.id === entrant?.withdrawnInMatchId
        );
        return leftIn?.log?.some(
            (entry) =>
                entry.action === "RETIRE" &&
                entrantOf(
                    entry.side === "A"
                        ? leftIn.sideA.entrantId
                        : leftIn.sideB.entrantId
                )?.id === entrant?.id
        )
            ? "retired"
            : "withdrew";
    };
    const other = (side: H2hSideName) => names[side === "A" ? "B" : "A"];
    /** The final and the third-place match lead nowhere */
    const isLast = match.stage === "FINAL" || match.stage === "THIRD_PLACE";
    const isPlaying = match.status === "IN_PROGRESS";
    const isFinished = match.status === "FINISHED";
    const notStarted = match.status === "WAITING" || match.status === "READY";
    const current = match.sets.find((set) => set.winnerSide === null);
    const extraPoint = canManage ? extraPointOf(match) : null;
    const amended = match.sets.some((set) =>
        set.points.some((point) => point.amendedAfterMatch)
    );
    const setScores = match.sets
        .map((set) => {
            const won = pointsWon(set);
            return `${won.a}–${won.b}`;
        })
        .join(" · ");
    const sideNames = (["A", "B"] as const).filter(
        (side) => competitors[side] !== null
    );

    const setLogs = (
        <>
            <p className="text-xs text-muted-foreground">
                First to {match.setsToWin}{" "}
                {match.setsToWin === 1 ? "set" : "sets"} · first to 3 points
            </p>
            {match.sets.map((set) => (
                <SetLog
                    key={set.setNumber}
                    set={set}
                    names={names}
                    competitors={competitors}
                    isCurrent={isPlaying && canManage && set === current}
                    onEnter={onEnter}
                    extraPointId={extraPoint?.id ?? null}
                    onExtra={
                        canManage && (isPlaying || extraPoint !== null)
                            ? (point) =>
                                  onAction({
                                      title: `Extra granted on point ${point.pointNumber}`,
                                      description: (
                                          <>
                                              <p>
                                                  {names.A} and {names.B} both
                                                  race point {point.pointNumber}{" "}
                                                  again, on a fresh scramble.
                                                  Their times on it no longer
                                                  count.
                                                  {isFinished &&
                                                      ` ${match.label} plays again, and the matches it led to wait for its new result.`}
                                              </p>
                                              <p className="mt-2 font-medium text-foreground">
                                                  {EXTRA_REMINDER}
                                              </p>
                                          </>
                                      ),
                                      confirmLabel: "Extra granted",
                                      onConfirm: (comment) =>
                                          grantExtra(
                                              roundId,
                                              point.id,
                                              comment
                                          ),
                                  })
                            : undefined
                    }
                />
            ))}
        </>
    );

    return (
        <li
            aria-label={match.label}
            className={cn(
                "flex flex-col gap-3 rounded-mobile-card border bg-card p-3 md:rounded-2xl md:p-4",
                isPlaying && "border-warning"
            )}
        >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="font-semibold">{match.label}</span>
                <Badge variant={STATUS_VARIANT[match.status]}>
                    {MATCH_STATUS_LABELS[match.status]}
                </Badge>
                {isFinished &&
                    (match.endedBy === "WALKOVER" ||
                        match.endedBy === "RETIRED") && (
                        <Badge variant="secondary">
                            {ENDED_TEXT[match.endedBy]}
                        </Badge>
                    )}
                <span className="min-w-0 flex-1 text-sm">
                    {(["A", "B"] as const).map((side, i) => (
                        <span key={side}>
                            {i === 1 &&
                                (match.sets.length > 0 ? (
                                    <span className="mx-2 font-mono font-semibold">
                                        {match.score.a}–{match.score.b}
                                    </span>
                                ) : (
                                    <span className="mx-2 text-muted-foreground">
                                        v
                                    </span>
                                ))}
                            <span
                                className={cn(
                                    match.winnerSide === side &&
                                        "font-semibold",
                                    !competitors[side] &&
                                        "italic text-muted-foreground"
                                )}
                            >
                                {names[side]}
                            </span>
                            {withdrawn[side] && (
                                <span className="ml-1 text-xs text-muted-foreground">
                                    ({leftAs(side)})
                                </span>
                            )}
                        </span>
                    ))}
                </span>
                {isFinished && setScores && (
                    <span className="text-xs text-muted-foreground">
                        Sets {setScores}
                    </span>
                )}
                {match.status === "READY" &&
                    // Seeds lock with the first start, so they come first
                    (bracket.status === "DRAFT" ? (
                        <span className="text-xs text-muted-foreground">
                            Fill every seed in the Bracket tab to start
                        </span>
                    ) : (
                        <Button size="sm" onClick={onStart} disabled={starting}>
                            <Play className="size-4" />
                            Start match
                        </Button>
                    ))}
            </div>

            {canManage && (
                <div className="flex flex-wrap gap-2">
                    {notStarted &&
                        bracket.status !== "DRAFT" &&
                        sideNames
                            .filter((side) => !withdrawn[side])
                            .map((side) => (
                                <Button
                                    key={side}
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                        onAction({
                                            title: `Withdraw ${names[side]}?`,
                                            description: isLast
                                                ? `${names[side]} won't play ${match.label}: it's a walkover for ${other(side)}, who wins it.`
                                                : `${names[side]} won't play ${match.label}: it's a walkover for ${other(side)}, who goes through. Any later match ${names[side]} would play is a walkover too.`,
                                            confirmLabel: "Withdraw",
                                            destructive: true,
                                            onConfirm: (comment) =>
                                                withdrawFromMatch(
                                                    roundId,
                                                    match.id,
                                                    side,
                                                    comment
                                                ),
                                        })
                                    }
                                >
                                    <UserX className="size-4" />
                                    Withdraw {names[side]}
                                </Button>
                            ))}
                    {isPlaying &&
                        sideNames.map((side) => (
                            <Button
                                key={side}
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                    onAction({
                                        title: `Retire ${names[side]}?`,
                                        description: `${names[side]} can't go on, so ${other(side)} wins ${match.label}${isLast ? "" : " and goes through"}. Points and sets already decided keep their winners, and every time stays.${isLast ? "" : ` Any later match ${names[side]} would play is a walkover.`}`,
                                        confirmLabel: "Retire",
                                        commentRequired: true,
                                        destructive: true,
                                        onConfirm: (comment) =>
                                            retireFromMatch(
                                                roundId,
                                                match.id,
                                                side,
                                                comment
                                            ),
                                    })
                                }
                            >
                                <LogOut className="size-4" />
                                Retire {names[side]}
                            </Button>
                        ))}
                    {isFinished && match.reopenRefusal && (
                        <span className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Button size="sm" variant="outline" disabled>
                                <Undo2 className="size-4" />
                                Reopen match
                            </Button>
                            Can't reopen: {match.reopenRefusal}
                        </span>
                    )}
                    {isFinished && !match.reopenRefusal && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                                onAction({
                                    title: `Reopen ${match.label}?`,
                                    description:
                                        "The match is decided again from its times as they are now, so correct them first. The matches it led to are taken back, which is only possible while none of them has started. A retirement or withdrawal in this match is undone. Only for cheating or a mistake (Regulation 11l).",
                                    confirmLabel: "Reopen match",
                                    commentRequired: true,
                                    destructive: true,
                                    onConfirm: (comment) =>
                                        reopenMatch(roundId, match.id, comment),
                                })
                            }
                        >
                            <Undo2 className="size-4" />
                            Reopen match
                        </Button>
                    )}
                </div>
            )}

            {match.log && match.log.length > 0 && (
                <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                    {match.log.map((entry, i) => (
                        <li key={i}>
                            {LOG_TEXT[entry.action]}
                            {entry.side && `: ${names[entry.side]}`}
                            {entry.comment && ` · ${entry.comment}`}
                            {" · "}
                            {entry.createdBy ? `by ${entry.createdBy}, ` : ""}
                            {formatDayTime(entry.createdAt)}
                        </li>
                    ))}
                </ul>
            )}

            {isPlaying && (
                <div className="flex flex-col gap-3">
                    {match.scrambleInUse && (
                        <div className="flex flex-col gap-1 rounded-lg bg-muted px-3 py-2 text-sm">
                            <span>
                                <span className="text-muted-foreground">
                                    Scramble for point{" "}
                                    {match.scrambleInUse.pointNumber}:{" "}
                                </span>
                                <span className="font-semibold">
                                    {match.scrambleInUse.text}
                                </span>
                            </span>
                            {match.scrambleInUse.warning && (
                                <span className="flex items-center gap-1.5 text-warning">
                                    <AlertTriangle className="size-4 shrink-0" />
                                    {match.scrambleInUse.warning}
                                </span>
                            )}
                        </div>
                    )}
                    {setLogs}
                </div>
            )}

            {isFinished && match.sets.length > 0 && (
                <details open={amended}>
                    <summary className="cursor-pointer text-sm">
                        Points
                        {amended && (
                            <span className="ml-2 text-xs text-warning">
                                Time amended after the match, winner unchanged
                            </span>
                        )}
                    </summary>
                    <div className="mt-2 flex flex-col gap-3">{setLogs}</div>
                </details>
            )}
        </li>
    );
};

interface MatchesTabProps {
    roundId: string;
    /**
     * Delegates enter missing results and handle extras, withdrawals,
     * retirements and reopening; stage leaders only start matches
     */
    canManage?: boolean;
}

/**
 * The staff screen for running the matches on the day (SPEC-001, Screens):
 * every match in order, Start match on a ready one, the playing match
 * point by point with manual entry for a missing result, and what a
 * delegate does when something goes wrong
 */
const MatchesTab = ({ roundId, canManage = true }: MatchesTabProps) => {
    const {
        data: view,
        isError,
        refetch,
    } = useLiveQuery(h2hRoundQuery(roundId));
    const competition = useAtomValue(competitionAtom);
    const { toast } = useToast();
    const [entering, setEntering] = useState<Competitor | null>(null);
    const [starting, setStarting] = useState<string | null>(null);
    const [action, setAction] = useState<MatchAction | null>(null);

    if (!view) {
        return isError ? (
            <RequestError onRetry={() => void refetch()} />
        ) : (
            <SectionLoading label="Loading the matches" />
        );
    }
    const bracket = view.bracket;
    if (!bracket) {
        return (
            <EmptyState>
                Create the bracket first, in the Bracket tab. Its matches show
                up here.
            </EmptyState>
        );
    }

    const start = async (match: H2hMatch) => {
        setStarting(match.id);
        const result = await startMatch(roundId, match.id);
        setStarting(null);
        if (!result.ok) {
            toast({
                title: "Couldn't start the match",
                description: result.message,
                variant: "destructive",
            });
        }
    };

    const timeLimit = competition
        ? getLimitByRoundId(roundId, competition.wcif) ?? undefined
        : undefined;
    const matches = [...bracket.matches].sort(
        (x, y) => x.matchNumber - y.matchNumber
    );

    return (
        <>
            <ul className="flex flex-col gap-3">
                {matches.map((match) => (
                    <MatchCard
                        key={match.id}
                        match={match}
                        roundId={roundId}
                        bracket={bracket}
                        starting={starting === match.id}
                        canManage={canManage}
                        onStart={() => void start(match)}
                        onEnter={setEntering}
                        onAction={setAction}
                    />
                ))}
            </ul>
            {entering && (
                <CreateAttemptModal
                    key={entering.personId}
                    isOpen
                    title={`${entering.name}'s result`}
                    onClose={() => {
                        setEntering(null);
                        void invalidateH2hRound(roundId);
                    }}
                    roundId={roundId}
                    competitorId={entering.personId}
                    timeLimit={timeLimit}
                />
            )}
            {action && (
                <MatchActionDialog
                    {...action}
                    onClose={() => setAction(null)}
                />
            )}
        </>
    );
};

export default MatchesTab;
