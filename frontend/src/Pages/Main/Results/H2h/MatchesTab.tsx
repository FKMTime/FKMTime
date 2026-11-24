import { useAtomValue } from "jotai";
import { AlertTriangle, Play } from "lucide-react";
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
    H2hBracket,
    H2hMatch,
    H2hMatchStatus,
    H2hPointAttempt,
    h2hRoundQuery,
    H2hSet,
    H2hSideName,
    invalidateH2hRound,
    MATCH_STATUS_LABELS,
    pointsWon,
    SET_DECISION_TEXT,
    sideLabel,
    startMatch,
} from "@/lib/h2h";
import { resultToString } from "@/lib/resultFormatters";
import { cn } from "@/lib/utils";

import CreateAttemptModal from "../Components/CreateAttemptModal";

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
}: {
    set: H2hSet;
    names: Record<H2hSideName, string>;
    competitors: Record<H2hSideName, Competitor | null>;
    /** The playing match's open set: missing results can be entered */
    isCurrent: boolean;
    onEnter: (competitor: Competitor) => void;
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
                                {!point.decided
                                    ? ""
                                    : point.winnerSide
                                      ? names[point.winnerSide]
                                      : "No winner"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                                {point.scramble &&
                                    `Set ${point.scramble.set}, ${point.scramble.isExtra ? "extra" : "scramble"} ${point.scramble.num}`}
                            </TableCell>
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
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </section>
    );
};

const MatchCard = ({
    match,
    bracket,
    starting,
    onStart,
    onEnter,
}: {
    match: H2hMatch;
    bracket: H2hBracket;
    starting: boolean;
    onStart: () => void;
    onEnter: (competitor: Competitor) => void;
}) => {
    const competitorOf = (entrantId: string | null): Competitor | null => {
        const entrant = bracket.entrants.find((e) => e.id === entrantId);
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
    const isPlaying = match.status === "IN_PROGRESS";
    const current = match.sets.find((set) => set.winnerSide === null);
    const setScores = match.sets
        .map((set) => {
            const won = pointsWon(set);
            return `${won.a}–${won.b}`;
        })
        .join(" · ");

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
                <span className="min-w-0 flex-1 text-sm">
                    <span
                        className={cn(
                            match.winnerSide === "A" && "font-semibold",
                            !competitors.A && "italic text-muted-foreground"
                        )}
                    >
                        {names.A}
                    </span>
                    {match.sets.length > 0 && (
                        <span className="mx-2 font-mono font-semibold">
                            {match.score.a}–{match.score.b}
                        </span>
                    )}
                    {match.sets.length === 0 && (
                        <span className="mx-2 text-muted-foreground">v</span>
                    )}
                    <span
                        className={cn(
                            match.winnerSide === "B" && "font-semibold",
                            !competitors.B && "italic text-muted-foreground"
                        )}
                    >
                        {names.B}
                    </span>
                </span>
                {match.status === "FINISHED" && setScores && (
                    <span className="text-xs text-muted-foreground">
                        Sets {setScores}
                    </span>
                )}
                {match.status === "READY" && (
                    <Button size="sm" onClick={onStart} disabled={starting}>
                        <Play className="size-4" />
                        Start match
                    </Button>
                )}
            </div>

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
                    <p className="text-xs text-muted-foreground">
                        First to {match.setsToWin}{" "}
                        {match.setsToWin === 1 ? "set" : "sets"} · first to 3
                        points
                    </p>
                    {match.sets.map((set) => (
                        <SetLog
                            key={set.setNumber}
                            set={set}
                            names={names}
                            competitors={competitors}
                            isCurrent={set === current}
                            onEnter={onEnter}
                        />
                    ))}
                </div>
            )}
        </li>
    );
};

interface MatchesTabProps {
    roundId: string;
}

/**
 * The staff screen for running the matches on the day (SPEC-001, Screens):
 * every match in order, Start match on a ready one, and the playing match
 * point by point, with manual entry for a missing result
 */
const MatchesTab = ({ roundId }: MatchesTabProps) => {
    const {
        data: view,
        isError,
        refetch,
    } = useLiveQuery(h2hRoundQuery(roundId));
    const competition = useAtomValue(competitionAtom);
    const { toast } = useToast();
    const [entering, setEntering] = useState<Competitor | null>(null);
    const [starting, setStarting] = useState<string | null>(null);

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
                        bracket={bracket}
                        starting={starting === match.id}
                        onStart={() => void start(match)}
                        onEnter={setEntering}
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
        </>
    );
};

export default MatchesTab;
