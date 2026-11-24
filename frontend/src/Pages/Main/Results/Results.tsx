import { useAtomValue } from "jotai";
import { Eraser, UserMinus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getLimitByRoundId, getNumberOfAttemptsForRound } from "wcif-helpers";

import { LiveRoundDot } from "@/Components/IntegratedLive/LiveResultBadges";
import WithdrawFromRoundModal from "@/Components/IntegratedLive/WithdrawFromRoundModal";
import LoadingPage from "@/Components/LoadingPage";
import EmptyState from "@/Components/shared/EmptyState";
import PageTabs from "@/Components/shared/PageTabs";
import RefreshingRegion from "@/Components/shared/RefreshingRegion";
import RequestError from "@/Components/shared/RequestError";
import RoundPicker from "@/Components/shared/RoundPicker";
import SearchInput from "@/Components/shared/SearchInput";
import SegmentedControl from "@/Components/shared/SegmentedControl";
import { useConfirm } from "@/hooks/useConfirm";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
    useIntegratedLiveRound,
    useIntegratedLiveRounds,
} from "@/hooks/useIntegratedLiveRound";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useIsMobile } from "@/hooks/useMobile";
import { usePageHeader } from "@/hooks/usePageHeader";
import { useSocketEvents } from "@/hooks/useSocketEvents";
import { useSocketRoom } from "@/hooks/useSocketRoom";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";
import {
    h2hRoundQuery,
    invalidateH2hExportChecks,
    rankH2hResults,
} from "@/lib/h2h";
import {
    clearIntegratedLiveResult,
    invalidateIntegratedLiveRounds,
} from "@/lib/integratedLive";
import { Result } from "@/lib/interfaces";
import {
    isDelegate,
    isStageLeaderOrOrganizerOrDelegate,
} from "@/lib/permissions";
import { LIVE_MAX_AGE } from "@/lib/queryCache";
import { rankResults } from "@/lib/ranking";
import { invalidateRoundResults, roundResultsSearchQuery } from "@/lib/results";
import { roomsQuery } from "@/lib/rooms";
import { getRoundMeta } from "@/lib/roundInfo";
import { getLiveRoundIds } from "@/lib/roundOptions";
import { cn, getAdvancementText } from "@/lib/utils";

import CreateAttemptModal from "./Components/CreateAttemptModal";
import RestartGroupModal from "./Components/RestartGroupModal";
import ResultsTable, { ResultsTableLive } from "./Components/ResultsTable";
import ResultsTabs from "./Components/ResultsTabs";
import RoundHeader from "./Components/RoundHeader";
import RoundMetaLine from "./Components/RoundMetaLine";
import BracketTab from "./H2h/BracketTab";
import MatchesTab from "./H2h/MatchesTab";
import RankingTab from "./H2h/RankingTab";
import ScramblePlanTab from "./H2h/ScramblePlanTab";

type Order = "ranking" | "latest";

/** A head-to-head round's tabs (SPEC-001) */
type H2hTab = "bracket" | "matches" | "ranking" | "scrambles" | "results";
const H2H_TABS: { value: H2hTab; label: string }[] = [
    { value: "bracket", label: "Bracket" },
    { value: "matches", label: "Matches" },
    { value: "ranking", label: "Ranking" },
    { value: "scrambles", label: "Scrambles" },
    { value: "results", label: "Results" },
];

const Results = () => {
    const { id: roundId = "" } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const competition = useAtomValue(competitionAtom);
    const { data: rooms } = useLiveQuery(roomsQuery, {
        maxAge: LIVE_MAX_AGE,
    });
    const [search, setSearch] = useState("");
    // Results the Checks tab loaded moments ago show straight away, and the
    // last results stay while the next round or search loads
    const debouncedSearch = useDebouncedValue(search, 250);
    const { data, isError, isPreviousData, refetch } = useLiveQuery(
        roundResultsSearchQuery(roundId, debouncedSearch),
        {
            maxAge: LIVE_MAX_AGE,
            keepPreviousData: true,
            enabled: !!roundId,
        }
    );
    const results: Result[] = useMemo(() => data ?? [], [data]);
    const refreshResults = () => void invalidateRoundResults(roundId);
    // Joined per round, not per search, so typing doesn't leave the room
    useSocketRoom(roundId ? "Results" : null, { params: { roundId } });
    useSocketEvents(roundId ? { resultEntered: refreshResults } : {});
    // A head-to-head round's tabs follow its bracket live (SPEC-001)
    const isH2h =
        !!roundId &&
        competition?.wcif.events
            .flatMap((event) => event.rounds)
            .find((round) => round.id === roundId)?.format === "h";
    const h2hQuery = h2hRoundQuery(roundId);
    useSocketRoom(isH2h ? "H2h" : null, {
        params: { roundId },
        invalidateOn: { h2hUpdated: [h2hQuery.key] },
    });
    // A query key is one array, so the export checks get their own listener
    useSocketEvents(
        isH2h
            ? { h2hUpdated: () => void invalidateH2hExportChecks(roundId) }
            : {}
    );
    const { data: h2hView } = useLiveQuery(h2hQuery, {
        maxAge: LIVE_MAX_AGE,
        enabled: isH2h,
    });
    const [order, setOrder] = useState<Order>("ranking");
    const [isRestartOpen, setIsRestartOpen] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const isMobile = useIsMobile();
    const [withdrawPersonId, setWithdrawPersonId] = useState<string | null>(
        null
    );
    const confirm = useConfirm();
    const { toast } = useToast();
    const liveRounds = useIntegratedLiveRounds();
    const { details: live, byResultId } = useIntegratedLiveRound(
        roundId || undefined
    );

    usePageHeader({
        crumbs: roundId
            ? [
                  { label: "Results", to: "/results" },
                  {
                      label: activityCodeToName(roundId).replace(", ", " · "),
                      eventId: roundId.split("-")[0],
                  },
              ]
            : [{ label: "Results" }],
    });

    // Stage leaders run a head-to-head round's matches, and see nothing
    // else here; everyone else but delegates gets the public view
    const canManage = isDelegate();
    const onlyMatches =
        !canManage && isH2h && isStageLeaderOrOrganizerOrDelegate();
    useEffect(() => {
        if (!competition || canManage || onlyMatches) return;
        navigate(`/results/public/${roundId}`, { replace: true });
    }, [navigate, roundId, competition, canManage, onlyMatches]);

    const liveRoundIds = useMemo(() => getLiveRoundIds(rooms ?? []), [rooms]);

    // /results opens the round in progress, or the first one
    useEffect(() => {
        if (roundId || !competition || !rooms) return;
        const target =
            liveRoundIds[0] ?? competition.wcif.events[0]?.rounds[0]?.id;
        if (target) navigate(`/results/round/${target}`, { replace: true });
    }, [roundId, competition, rooms, liveRoundIds, navigate]);

    /** Empties a result in WCA live results; FKMTime's is sent again */
    const clearInWca = (
        registrationId: number,
        personName: string,
        hasOurs: boolean
    ) =>
        confirm({
            title: `Clear ${personName} in WCA live results?`,
            description: hasOurs
                ? "FKMTime sends its result again right after, so WCA live results ends up matching it."
                : "FKMTime has no result for them, so it stays empty.",
            confirmLabel: "Clear",
            onConfirm: async () => {
                const { ok, message } = await clearIntegratedLiveResult(
                    roundId,
                    registrationId
                );
                toast(
                    ok
                        ? { title: message, variant: "success" }
                        : {
                              title: "Error",
                              description: message,
                              variant: "destructive",
                          }
                );
                void invalidateIntegratedLiveRounds();
            },
        }).catch(() => undefined);

    const liveTable: ResultsTableLive | undefined = live && {
        byResultId,
        onlyInWca: live.onlyInWca,
        onClearOnlyInWca: (row) =>
            clearInWca(
                row.registrationId,
                row.name ?? `registration ${row.registrationId}`,
                false
            ),
        itemsFor: (result, view) => [
            {
                label: "Clear in WCA live results",
                icon: Eraser,
                destructive: true,
                hidden: !view?.registrationId || !view.wcaAttempts?.length,
                onSelect: () =>
                    clearInWca(view!.registrationId!, result.person.name, true),
            },
            {
                // A later-round competitor who hasn't competed (9p3)
                label: "Remove from round",
                icon: UserMinus,
                destructive: true,
                hidden:
                    roundId.endsWith("-r1") ||
                    live.state !== "open" ||
                    !view ||
                    view.wcaAttempts === null ||
                    view.wcaAttempts.length > 0,
                onSelect: () => setWithdrawPersonId(result.person.id),
            },
        ],
    };

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
    const h2hTabs = onlyMatches
        ? H2H_TABS.filter((t) => t.value === "matches")
        : H2H_TABS;
    const h2hTab: H2hTab = onlyMatches
        ? "matches"
        : H2H_TABS.find((t) => t.value === searchParams.get("tab"))?.value ??
          "bracket";
    const showResults = !isH2h || h2hTab === "results";
    const h2hRanked = isH2h
        ? rankH2hResults(results, h2hView?.bracket?.entrants ?? [])
        : null;
    const ranked = h2hRanked ?? rankResults(results, maxAttempts, format);
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
            {/* Desktop: the round's actions share the picker's row */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-3">
                <RoundPicker
                    className="min-w-0 lg:flex-1"
                    wcif={wcif}
                    liveRoundIds={liveRoundIds}
                    timeline
                    steps
                    value={roundId}
                    onValueChange={(id) => navigate(`/results/round/${id}`)}
                    getMarker={
                        liveRounds
                            ? (id) => (
                                  <LiveRoundDot
                                      round={liveRounds.find(
                                          (r) => r.roundId === id
                                      )}
                                  />
                              )
                            : undefined
                    }
                />
                {roundId && canManage && (
                    <RoundHeader
                        roundId={roundId}
                        meta={getRoundMeta(roundId, wcif)}
                        advancement={getAdvancementText(roundId, event)}
                        live={live}
                        hasResults={results.length > 0}
                        onEnterAttempt={() => setIsCreateOpen(true)}
                        onRestartGroup={() => setIsRestartOpen(true)}
                    />
                )}
            </div>

            {roundId && isH2h && (
                <PageTabs
                    label="Head-to-head round"
                    value={h2hTab}
                    onValueChange={(tab) => setSearchParams({ tab })}
                    tabs={h2hTabs}
                />
            )}
            {roundId && isH2h && h2hTab === "bracket" && (
                <BracketTab roundId={roundId} />
            )}
            {roundId && isH2h && h2hTab === "matches" && (
                <MatchesTab roundId={roundId} canManage={canManage} />
            )}
            {roundId && isH2h && h2hTab === "ranking" && (
                <RankingTab roundId={roundId} />
            )}
            {roundId && isH2h && h2hTab === "scrambles" && (
                <ScramblePlanTab roundId={roundId} />
            )}

            {roundId && canManage && (
                <>
                    {showResults && (
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
                                {!isMobile && (
                                    <RoundMetaLine
                                        meta={getRoundMeta(roundId, wcif)}
                                        advancement={getAdvancementText(
                                            roundId,
                                            event
                                        )}
                                        live={live}
                                        className="ml-auto"
                                    />
                                )}
                                <span
                                    className={cn(
                                        "text-sm text-muted-foreground",
                                        isMobile ? "ml-auto" : "border-l pl-4"
                                    )}
                                >
                                    {results.length}{" "}
                                    {results.length === 1
                                        ? "result"
                                        : "results"}
                                </span>
                            </div>
                            {isError && (
                                <RequestError
                                    hasData={!!data}
                                    onRetry={() => void refetch()}
                                />
                            )}
                            <RefreshingRegion isRefreshing={isPreviousData}>
                                {rows.length === 0 &&
                                !liveTable?.onlyInWca.length ? (
                                    <p className="p-8 text-center text-sm text-muted-foreground">
                                        {search
                                            ? "No results match."
                                            : "No results yet."}
                                    </p>
                                ) : (
                                    <ResultsTable
                                        rows={rows}
                                        maxAttempts={maxAttempts}
                                        onDeleted={refreshResults}
                                        live={liveTable}
                                        stageReached={
                                            h2hRanked
                                                ? (result) =>
                                                      h2hRanked.find(
                                                          (row) =>
                                                              row.result.id ===
                                                              result.id
                                                      )?.stageReached ?? null
                                                : undefined
                                        }
                                    />
                                )}
                            </RefreshingRegion>
                        </section>
                    )}

                    <CreateAttemptModal
                        isOpen={isCreateOpen}
                        onClose={() => {
                            setIsCreateOpen(false);
                            refreshResults();
                        }}
                        roundId={roundId}
                        timeLimit={
                            getLimitByRoundId(roundId, wcif) ?? undefined
                        }
                    />
                    {withdrawPersonId && (
                        <WithdrawFromRoundModal
                            key={withdrawPersonId}
                            isOpen
                            onClose={() => {
                                setWithdrawPersonId(null);
                                refreshResults();
                            }}
                            roundId={roundId}
                            personId={withdrawPersonId}
                        />
                    )}
                    <RestartGroupModal
                        isOpen={isRestartOpen}
                        onClose={() => {
                            setIsRestartOpen(false);
                            refreshResults();
                        }}
                        roundId={roundId}
                        wcif={wcif}
                    />
                </>
            )}

            {!roundId && !wcif.events.some((e) => e.rounds.length > 0) && (
                <EmptyState>This competition has no rounds.</EmptyState>
            )}
        </div>
    );
};

export default Results;
