import { useAtomValue } from "jotai";
import {
    ChartNoAxesColumn,
    Keyboard,
    Layers,
    LucideIcon,
    RefreshCw,
    User,
} from "lucide-react";
import { useEffect, useState } from "react";

import LoadingPage from "@/Components/LoadingPage";
import { activityCodeToName } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";
import { getCompetitionStatistics } from "@/lib/competition";
import { getEventIconClass } from "@/lib/events";
import {
    CompetitionStatistics as ICompetitionStatistics,
    RoundAttemptStatistics,
} from "@/lib/interfaces";
import { cn } from "@/lib/utils";
import { socket } from "@/socket";

import Charts from "./Charts";

const ROUND_GRID =
    "grid grid-cols-[minmax(180px,1.2fr)_minmax(160px,2fr)_70px_80px_70px_60px] gap-4 px-5";

const RoundName = ({ roundId }: { roundId: string }) => (
    <span className="flex min-w-0 items-center gap-2 font-semibold">
        <span
            aria-hidden
            className={cn(
                "cubing-icon text-[17px]",
                getEventIconClass(roundId.split("-")[0])
            )}
        />
        <span className="truncate">
            {activityCodeToName(roundId).replace(", ", " · ")}
        </span>
    </span>
);

const Bar = ({ value, max }: { value: number; max: number }) => (
    <span className="block h-1.5 overflow-hidden rounded-full bg-track md:h-2">
        <span
            className="block h-full rounded-full bg-primary"
            style={{ width: `${max ? Math.round((value / max) * 100) : 0}%` }}
        />
    </span>
);

const CompetitionStatistics = () => {
    const competition = useAtomValue(competitionAtom);
    const [statistics, setStatistics] = useState<ICompetitionStatistics | null>(
        null
    );

    useEffect(() => {
        const fetchData = () => getCompetitionStatistics().then(setStatistics);
        fetchData();
        socket.emit("joinStatistics");
        socket.on("statisticsUpdated", fetchData);
        return () => {
            socket.off("statisticsUpdated", fetchData);
            socket.emit("leaveStatistics");
        };
    }, []);

    if (!statistics) return <LoadingPage />;

    const tiles: { label: string; value: number; icon: LucideIcon }[] = [
        {
            label: "Total solves",
            value: statistics.allAttempts,
            icon: ChartNoAxesColumn,
        },
        {
            label: "Manually entered",
            value: statistics.attemptsEnteredManually,
            icon: Keyboard,
        },
        {
            label: "Extra attempts",
            value: statistics.extraAttemptsUsed,
            icon: RefreshCw,
        },
        {
            label: "Scorecards",
            value: statistics.scorecardsCount,
            icon: Layers,
        },
        { label: "Competitors", value: statistics.personsCompeted, icon: User },
    ];

    // Schedule order; rounds missing from the WCIF (removed since) go last
    const order =
        competition?.wcif.events.flatMap((event) =>
            event.rounds.map((round) => round.id)
        ) ?? [];
    const position = (roundId: string) => {
        const index = order.indexOf(roundId);
        return index === -1 ? order.length : index;
    };
    const rounds: RoundAttemptStatistics[] = [
        ...(statistics.byRoundAttemptStats ?? []),
    ].sort((a, b) => position(a.roundId) - position(b.roundId));
    const maxSolves = Math.max(0, ...rounds.map((round) => round.solves));

    return (
        <>
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-[repeat(auto-fit,minmax(170px,1fr))] md:gap-3">
                {tiles.map((tile) => (
                    <div
                        key={tile.label}
                        className="flex flex-col gap-1.5 rounded-mobile-card border bg-card p-3.5 md:rounded-2xl md:px-[18px] md:py-4"
                    >
                        <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                            <tile.icon aria-hidden className="size-[17px]" />
                            {tile.label}
                        </span>
                        <span className="text-2xl font-bold md:text-[28px] md:leading-9">
                            {tile.value ?? 0}
                        </span>
                    </div>
                ))}
            </div>
            {rounds.length > 0 && (
                <section aria-labelledby="by-round">
                    <h2
                        id="by-round"
                        className="mb-2 pl-0.5 text-xs font-semibold text-faint md:hidden"
                    >
                        By round
                    </h2>
                    <ul className="overflow-hidden rounded-mobile-card border bg-card md:hidden">
                        {rounds.map((round) => (
                            <li
                                key={round.roundId}
                                className="flex flex-col gap-2 border-b px-3.5 py-3 last:border-b-0"
                            >
                                <div className="flex items-center gap-2 text-[15px]">
                                    <span className="min-w-0 flex-1">
                                        <RoundName roundId={round.roundId} />
                                    </span>
                                    <b>{round.solves}</b>
                                </div>
                                <Bar value={round.solves} max={maxSolves} />
                                <span className="text-xs text-muted-foreground">
                                    {round.manual} manual · {round.extras}{" "}
                                    extras · {round.dnf} DNF
                                </span>
                            </li>
                        ))}
                    </ul>
                    <div className="hidden overflow-x-auto rounded-2xl border bg-card md:block">
                        <div className="border-b px-5 py-3.5 text-[15px] font-bold">
                            By round
                        </div>
                        <div
                            className={cn(
                                ROUND_GRID,
                                "py-2.5 text-xs font-semibold text-muted-foreground"
                            )}
                        >
                            <span>Round</span>
                            <span />
                            <span className="text-right">Solves</span>
                            <span className="text-right">Manual</span>
                            <span className="text-right">Extras</span>
                            <span className="text-right">DNF</span>
                        </div>
                        {rounds.map((round) => (
                            <div
                                key={round.roundId}
                                className={cn(
                                    ROUND_GRID,
                                    "min-h-11 items-center border-t text-sm"
                                )}
                            >
                                <RoundName roundId={round.roundId} />
                                <Bar value={round.solves} max={maxSolves} />
                                <span className="text-right font-semibold">
                                    {round.solves}
                                </span>
                                <span className="text-right text-muted-foreground">
                                    {round.manual}
                                </span>
                                <span className="text-right text-muted-foreground">
                                    {round.extras}
                                </span>
                                <span className="text-right text-muted-foreground">
                                    {round.dnf}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>
            )}
            <Charts statistics={statistics} />
        </>
    );
};

export default CompetitionStatistics;
