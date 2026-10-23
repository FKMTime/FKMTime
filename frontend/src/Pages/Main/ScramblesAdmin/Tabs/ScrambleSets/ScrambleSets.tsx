import { useAtomValue } from "jotai";
import { EllipsisVertical, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import EmptyState from "@/Components/shared/EmptyState";
import RefreshingRegion from "@/Components/shared/RefreshingRegion";
import { Button } from "@/Components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";
import { getEventIconClass } from "@/lib/events";
import { ScrambleSet } from "@/lib/interfaces";
import {
    deleteAllScrambleSets,
    deleteScrambleSetsByRoundId,
    getScrambleSetCounts,
    getScrambleSets,
} from "@/lib/scrambleSets";
import { cn, letterToNumber } from "@/lib/utils";

import AddScrambleSetModal from "./Components/AddScrambleSetModal";
import ScrambleSetRow from "./Components/ScrambleSetRow";

const roundName = (roundId: string) =>
    activityCodeToName(roundId).replace(", ", " · ");

const setCountLabel = (count: number) =>
    count ? `${count} ${count === 1 ? "set" : "sets"}` : "Missing";

const ScrambleSets = () => {
    const confirm = useConfirm();
    const { toast } = useToast();
    const competition = useAtomValue(competitionAtom);
    const [searchParams, setSearchParams] = useSearchParams();
    const [scrambleSets, setScrambleSets] = useState<ScrambleSet[]>([]);
    const [counts, setCounts] = useState<Map<string, number>>(new Map());
    const [isAddOpen, setIsAddOpen] = useState(false);

    const roundIds = useMemo(
        () =>
            competition?.wcif.events.flatMap((event) =>
                event.rounds.map((round) => round.id)
            ) ?? [],
        [competition]
    );
    const roundId = searchParams.get("roundId") || roundIds[0] || "";

    const lastSetNumber = letterToNumber(
        scrambleSets.reduce(
            (last, set) => (last < set.set ? set.set : last),
            "A"
        )
    );

    // The round the shown sets belong to; differs while the next loads
    const [setsRoundId, setSetsRoundId] = useState<string>();
    const fetchData = useCallback(async () => {
        const [sets, setCountsData] = await Promise.all([
            roundId ? getScrambleSets(roundId) : [],
            getScrambleSetCounts(),
        ]);
        setScrambleSets(sets);
        setSetsRoundId(roundId);
        setCounts(
            new Map(setCountsData.map((entry) => [entry.roundId, entry.count]))
        );
    }, [roundId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const selectRound = (id: string) =>
        setSearchParams({ tab: "scrambleSets", roundId: id });

    const runDelete = async (
        title: string,
        description: string,
        remove: () => Promise<number>
    ) => {
        try {
            await confirm({ title, description, confirmLabel: "Delete" });
        } catch {
            toast({ title: "Scramble sets not deleted" });
            return;
        }
        const status = await remove();
        if (status === 204) {
            fetchData();
        } else {
            toast({ title: "Something went wrong", variant: "destructive" });
        }
    };

    const handleDeleteRound = () =>
        runDelete(
            "Delete scramble sets",
            `Are you sure you want to delete all scramble sets for ${roundName(roundId)}?`,
            () => deleteScrambleSetsByRoundId(roundId)
        );

    const handleDeleteAll = () =>
        runDelete(
            "Delete all scramble sets",
            "Are you sure you want to delete all scramble sets for every round?",
            deleteAllScrambleSets
        );

    if (!competition) return <LoadingPage />;

    return (
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[minmax(240px,320px)_minmax(0,1fr)] md:gap-5">
            <nav
                aria-label="Rounds"
                className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-col md:gap-0 md:rounded-2xl md:border md:bg-card md:p-1.5"
            >
                {roundIds.map((id) => {
                    const isSelected = id === roundId;
                    const count = counts.get(id) ?? 0;
                    return (
                        <button
                            key={id}
                            type="button"
                            aria-current={isSelected || undefined}
                            onClick={() => selectRound(id)}
                            className={cn(
                                "flex h-11 shrink-0 items-center gap-2.5 rounded-chip border px-3 text-left text-sm font-semibold transition-colors md:rounded-lg md:border-0 md:px-2.5",
                                isSelected
                                    ? "border-primary bg-primary-soft text-primary"
                                    : "bg-card hover:bg-accent md:bg-transparent"
                            )}
                        >
                            <span
                                aria-hidden
                                className={cn(
                                    "cubing-icon text-lg",
                                    getEventIconClass(id.split("-")[0])
                                )}
                            />
                            <span className="whitespace-nowrap md:flex-1">
                                {roundName(id)}
                            </span>
                            <span
                                className={cn(
                                    "whitespace-nowrap text-xs font-normal",
                                    count ? "text-faint" : "text-destructive"
                                )}
                            >
                                {setCountLabel(count)}
                            </span>
                        </button>
                    );
                })}
            </nav>
            {roundId && (
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2.5">
                        <h2 className="min-w-0 flex-1 truncate text-base font-bold md:text-lg">
                            {roundName(roundId)}
                        </h2>
                        <Button size="sm" onClick={() => setIsAddOpen(true)}>
                            <Plus />
                            Add scramble set
                        </Button>
                        <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label="More scramble set actions"
                                >
                                    <EllipsisVertical />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                align="end"
                                className="min-w-[220px]"
                            >
                                <DropdownMenuItem
                                    onSelect={handleDeleteRound}
                                    disabled={scrambleSets.length === 0}
                                    className="text-destructive focus:text-destructive [&>svg]:!text-destructive"
                                >
                                    <Trash2 />
                                    Delete sets for this round
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onSelect={handleDeleteAll}
                                    className="text-destructive focus:text-destructive [&>svg]:!text-destructive"
                                >
                                    <Trash2 />
                                    Delete all scramble sets
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    <RefreshingRegion isRefreshing={setsRoundId !== roundId}>
                        {scrambleSets.length === 0 ? (
                            <EmptyState className="min-h-[160px] text-destructive">
                                No scrambles for this round yet
                            </EmptyState>
                        ) : (
                            <ul className="overflow-hidden rounded-mobile-card border bg-card md:rounded-2xl">
                                {scrambleSets.map((scrambleSet) => (
                                    <ScrambleSetRow
                                        key={scrambleSet.id}
                                        scrambleSet={scrambleSet}
                                        fetchData={fetchData}
                                    />
                                ))}
                            </ul>
                        )}
                    </RefreshingRegion>
                </div>
            )}
            <AddScrambleSetModal
                isOpen={isAddOpen}
                onClose={() => {
                    setIsAddOpen(false);
                    fetchData();
                }}
                lastSet={lastSetNumber}
                roundId={roundId}
            />
        </div>
    );
};

export default ScrambleSets;
