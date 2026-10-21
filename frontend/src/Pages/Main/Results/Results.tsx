import { useAtomValue } from "jotai";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getLimitByRoundId, getNumberOfAttemptsForRound } from "wcif-helpers";

import LoadingPage from "@/Components/LoadingPage";
import EmptyState from "@/Components/shared/EmptyState";
import RefreshingRegion from "@/Components/shared/RefreshingRegion";
import RoundStrip from "@/Components/shared/RoundStrip";
import SearchInput from "@/Components/shared/SearchInput";
import SegmentedControl from "@/Components/shared/SegmentedControl";
import { usePageHeader } from "@/hooks/usePageHeader";
import { competitionAtom } from "@/lib/atoms";
import { Result, Room } from "@/lib/interfaces";
import { isDelegate } from "@/lib/permissions";
import { rankResults } from "@/lib/ranking";
import { getResultsByRoundId } from "@/lib/results";
import { getAllRooms } from "@/lib/rooms";
import { getRoundMeta } from "@/lib/roundInfo";
import { getRoundOptions, getStripRounds } from "@/lib/roundOptions";
import { getAdvancementText, shortRoundName } from "@/lib/utils";
import { socket, SocketContext } from "@/socket";

import CreateAttemptModal from "./Components/CreateAttemptModal";
import RestartGroupModal from "./Components/RestartGroupModal";
import ResultsTable from "./Components/ResultsTable";
import ResultsTabs from "./Components/ResultsTabs";
import RoundHeader from "./Components/RoundHeader";

type Order = "ranking" | "latest";

const Results = () => {
    const { id: roundId = "" } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const competition = useAtomValue(competitionAtom);
    const [isConnected] = useContext(SocketContext) as [
        number,
        React.Dispatch<React.SetStateAction<number>>,
    ];
    const [rooms, setRooms] = useState<Room[] | null>(null);
    const [results, setResults] = useState<Result[]>([]);
    // The round the shown results belong to; differs while the next loads
    const [resultsRoundId, setResultsRoundId] = useState<string>();
    const [search, setSearch] = useState("");
    const [order, setOrder] = useState<Order>("ranking");
    const [isRestartOpen, setIsRestartOpen] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    usePageHeader({
        crumbs: roundId
            ? [
                  { label: "Results", to: "/results" },
                  { label: shortRoundName(roundId) },
              ]
            : [{ label: "Results" }],
    });

    useEffect(() => {
        if (!isDelegate())
            navigate(`/results/public/${roundId}`, { replace: true });
    }, [navigate, roundId]);

    useEffect(() => {
        getAllRooms().then(setRooms);
    }, []);

    const rounds = useMemo(
        () =>
            competition && rooms
                ? getRoundOptions(competition.wcif, rooms)
                : [],
        [competition, rooms]
    );

    // /results opens the round in progress, or the first one
    useEffect(() => {
        if (roundId || rounds.length === 0) return;
        const target = rounds.find((round) => round.isLive) ?? rounds[0];
        navigate(`/results/round/${target.id}`, { replace: true });
    }, [roundId, rounds, navigate]);

    const fetchResults = useCallback(async () => {
        if (!roundId) return;
        setResults(await getResultsByRoundId(roundId, search || undefined));
        setResultsRoundId(roundId);
    }, [roundId, search]);

    useEffect(() => {
        const timeout = setTimeout(fetchResults, 250);
        return () => clearTimeout(timeout);
    }, [fetchResults]);

    useEffect(() => {
        if (!roundId) return;
        socket.emit("joinResults", { roundId });
        socket.on("resultEntered", fetchResults);
        return () => {
            socket.off("resultEntered", fetchResults);
            socket.emit("leaveResults", { roundId });
        };
    }, [roundId, fetchResults, isConnected]);

    if (!competition || !rooms) return <LoadingPage />;

    const wcif = competition.wcif;
    const maxAttempts = roundId
        ? getNumberOfAttemptsForRound(roundId, wcif)
        : 0;
    const format =
        wcif.events
            .flatMap((event) => event.rounds)
            .find((round) => round.id === roundId)?.format ?? "a";
    const event = wcif.events.find((e) => e.id === roundId.split("-")[0]);
    const ranked = rankResults(results, maxAttempts, format);
    const rows =
        order === "latest"
            ? [...ranked].sort(
                  (a, b) =>
                      new Date(b.result.updatedAt).getTime() -
                      new Date(a.result.updatedAt).getTime()
              )
            : ranked;

    return (
        <div className="flex flex-col gap-4">
            <ResultsTabs value="rounds" roundId={roundId} />
            <RoundStrip
                rounds={getStripRounds(rounds, roundId)}
                allRounds={rounds}
                value={roundId}
                onValueChange={(id) => navigate(`/results/round/${id}`)}
            />

            {roundId && (
                <>
                    <RoundHeader
                        roundId={roundId}
                        meta={getRoundMeta(roundId, wcif)}
                        advancement={getAdvancementText(roundId, event)}
                        hasResults={results.length > 0}
                        onEnterAttempt={() => setIsCreateOpen(true)}
                        onRestartGroup={() => setIsRestartOpen(true)}
                    />

                    <section className="overflow-hidden rounded-mobile-card border bg-card md:rounded-2xl">
                        <div className="flex flex-wrap items-center gap-3 border-b p-3 md:px-5">
                            <SearchInput
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                label="Search results"
                                placeholder="Search by name, WCA ID or ID"
                                className="md:max-w-xs"
                            />
                            <SegmentedControl
                                label="Order"
                                value={order}
                                onValueChange={setOrder}
                                options={[
                                    { value: "ranking", label: "Ranking" },
                                    { value: "latest", label: "Latest" },
                                ]}
                            />
                            <span className="ml-auto text-sm text-muted-foreground">
                                {results.length}{" "}
                                {results.length === 1 ? "result" : "results"}
                            </span>
                        </div>
                        <RefreshingRegion
                            isRefreshing={resultsRoundId !== roundId}
                        >
                            {rows.length === 0 ? (
                                <p className="p-8 text-center text-sm text-muted-foreground">
                                    {search
                                        ? "No results match."
                                        : "No results yet."}
                                </p>
                            ) : (
                                <ResultsTable
                                    rows={rows}
                                    maxAttempts={maxAttempts}
                                    onDeleted={fetchResults}
                                />
                            )}
                        </RefreshingRegion>
                    </section>

                    <CreateAttemptModal
                        isOpen={isCreateOpen}
                        onClose={() => {
                            setIsCreateOpen(false);
                            fetchResults();
                        }}
                        roundId={roundId}
                        timeLimit={
                            getLimitByRoundId(roundId, wcif) ?? undefined
                        }
                    />
                    <RestartGroupModal
                        isOpen={isRestartOpen}
                        onClose={() => {
                            setIsRestartOpen(false);
                            fetchResults();
                        }}
                        roundId={roundId}
                        wcif={wcif}
                    />
                </>
            )}

            {!roundId && rounds.length === 0 && (
                <EmptyState>This competition has no rounds.</EmptyState>
            )}
        </div>
    );
};

export default Results;
