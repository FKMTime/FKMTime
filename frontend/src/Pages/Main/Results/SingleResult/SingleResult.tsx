import { useAtom } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    getLimitByRoundId,
    getNumberOfAttemptsForRound,
    getRoundInfoFromWcif,
} from "wcif-helpers";

import LoadingPage from "@/Components/LoadingPage";
import EmptyState from "@/Components/shared/EmptyState";
import PageTabs from "@/Components/shared/PageTabs";
import { Button } from "@/Components/ui/button";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { usePageHeader } from "@/hooks/usePageHeader";
import { useToast } from "@/hooks/useToast";
import { competitionAtom } from "@/lib/atoms";
import {
    dnfRulingQuery,
    ExtrasContext,
    extrasContextQuery,
    updateAttempt,
} from "@/lib/attempt";
import { average, formattedBest } from "@/lib/average";
import { getCompetitionInfo } from "@/lib/competition";
import { AttemptStatus, Result } from "@/lib/interfaces";
import { QueryError, toQueryOptions } from "@/lib/queryCache";
import { queryClient } from "@/lib/queryClient";
import { resultToString } from "@/lib/resultFormatters";
import { personResultsQuery, resultQuery } from "@/lib/results";
import {
    getAttemptsToDnf,
    getSubmittedAttempts,
    hasRemainingAttempts,
    shortRoundName,
} from "@/lib/utils";

import CreateAttemptModal from "../Components/CreateAttemptModal";
import AttemptsReorderBoard from "./Components/AttemptsReorderBoard";
import AttemptsTable from "./Components/AttemptsTable";
import DnfAttemptsModal from "./Components/DnfAttemptsModal";
import DnfRulingCard from "./Components/DnfRulingCard";
import GiveExtrasModal from "./Components/GiveExtrasModal";
import LastAttemptCard from "./Components/LastAttemptCard";
import RemovedResultBanner from "./Components/RemovedResultBanner";
import RemoveResultModal from "./Components/RemoveResultModal";
import ReplacedAttemptsCard from "./Components/ReplacedAttemptsCard";
import SingleResultHeader from "./Components/SingleResultHeader";
import SwapAttemptsModal from "./Components/SwapAttemptsModal";
import WarningsAndLimitsCard from "./Components/WarningsAndLimitsCard";

type Tab = "submitted" | "standard" | "extra" | "reorder";

const roundNumber = (roundId: string) => +roundId.split("-r")[1];

const SingleResult = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [competition, setCompetition] = useAtom(competitionAtom);
    const resultId = id ?? "";
    const { data: resultData, error } = useLiveQuery(resultQuery(resultId), {
        enabled: !!id,
    });
    const result: Result | null = resultData ?? null;
    const remainingAndUsedCumulativeLimit =
        resultData?.remainingAndUsedCumulativeLimit ?? null;
    const { data: extrasContextData } = useLiveQuery(
        extrasContextQuery(resultId),
        { enabled: !!id }
    );
    const extrasContext: ExtrasContext | null = extrasContextData ?? null;
    const { data: dnfRuling } = useLiveQuery(dnfRulingQuery(resultId), {
        enabled: !!id,
    });
    const [isOpenCreateAttemptModal, setIsOpenCreateAttemptModal] =
        useState<boolean>(false);
    const [isOpenSwapAttemptsModal, setIsOpenSwapAttemptsModal] =
        useState<boolean>(false);
    const [tab, setTab] = useState<Tab>("submitted");
    const [isOpenGiveExtrasModal, setIsOpenGiveExtrasModal] = useState(false);
    const [isOpenDnfModal, setIsOpenDnfModal] = useState(false);
    const [isOpenRemoveModal, setIsOpenRemoveModal] = useState(false);
    // The competitor's other rounds, for removing later ones (Regulation 9t)
    const { data: personResults } = useLiveQuery(
        personResultsQuery(resultData?.person.id ?? ""),
        { enabled: !!resultData && isOpenDnfModal }
    );
    const standardAttempts = useMemo(() => {
        if (!result) return [];
        return (
            result.attempts
                .filter((attempt) => attempt.type === "STANDARD_ATTEMPT")
                .sort((a, b) => a.attemptNumber - b.attemptNumber) || []
        );
    }, [result]);
    const extraAttempts = useMemo(() => {
        if (!result) return [];
        return (
            result.attempts
                .filter((attempt) => attempt.type === "EXTRA_ATTEMPT")
                .sort((a, b) => a.attemptNumber - b.attemptNumber) || []
        );
    }, [result]);
    const submittedAttempts = useMemo(() => {
        if (!result) return [];
        return getSubmittedAttempts(result.attempts);
    }, [result]);

    const limit = useMemo(() => {
        if (!competition || !result) {
            return null;
        }
        return getLimitByRoundId(result.roundId, competition.wcif);
    }, [competition, result]);

    const maxAttempts = useMemo(() => {
        if (!competition || !result) {
            return 0;
        }
        return getNumberOfAttemptsForRound(result.roundId, competition.wcif);
    }, [competition, result]);

    // Opened from a link, the competition may not be loaded yet
    useEffect(() => {
        if (competition) return;
        getCompetitionInfo().then((response) => setCompetition(response.data));
    }, [competition, setCompetition]);

    useEffect(() => {
        if (error instanceof QueryError && error.status === 404) {
            toast({
                title: "Error",
                description: "Result not found",
                variant: "destructive",
            });
            navigate("/results");
        }
    }, [error, navigate, toast]);

    const fetchData = () =>
        Promise.all([
            queryClient.invalidateQueries({
                queryKey: toQueryOptions(resultQuery(resultId)).queryKey,
            }),
            queryClient.invalidateQueries({
                queryKey: toQueryOptions(extrasContextQuery(resultId)).queryKey,
            }),
            queryClient.invalidateQueries({
                queryKey: toQueryOptions(dnfRulingQuery(resultId)).queryKey,
            }),
            ...(resultData
                ? [
                      queryClient.invalidateQueries({
                          queryKey: toQueryOptions(
                              personResultsQuery(resultData.person.id)
                          ).queryKey,
                      }),
                  ]
                : []),
        ]);

    const handleCloseModal = () => {
        fetchData();
        setIsOpenCreateAttemptModal(false);
        setIsOpenSwapAttemptsModal(false);
        setIsOpenGiveExtrasModal(false);
        setIsOpenDnfModal(false);
        setIsOpenRemoveModal(false);
    };

    usePageHeader({
        crumbs: result
            ? [
                  { label: "Results", to: "/results" },
                  {
                      label: shortRoundName(result.roundId),
                      to: `/results/round/${result.roundId}`,
                  },
                  { label: result.person.name },
              ]
            : [{ label: "Results", to: "/results" }, { label: "Result" }],
        title: result?.person.name ?? "Result",
        subtitle: result ? shortRoundName(result.roundId) : undefined,
        backTo: result ? `/results/round/${result.roundId}` : "/results",
    });

    if (!result || !competition) return <LoadingPage />;

    const isHeadToHead =
        getRoundInfoFromWcif(result.roundId, competition.wcif)?.format === "h";
    const canGiveExtras = submittedAttempts.length > 0 && !isHeadToHead;
    const isRemoved = !!result.removedAt;
    const canDnfAll =
        (getAttemptsToDnf(result.attempts).length > 0 ||
            hasRemainingAttempts(result.attempts, maxAttempts)) &&
        !isHeadToHead &&
        !isRemoved;
    const canRemove = roundNumber(result.roundId) > 1 && !isRemoved;
    const eventResults = (personResults ?? [])
        .filter((other) => other.eventId === result.eventId && !other.removedAt)
        .sort((a, b) => roundNumber(a.roundId) - roundNumber(b.roundId));
    const openIncidents = result.attempts.filter(
        (attempt) => attempt.status === AttemptStatus.UNRESOLVED
    );
    const [openIncident] = openIncidents;

    const handleGiveExtras = () => {
        if (openIncidents.length > 1) {
            toast({
                title: "Resolve the open incidents first",
                variant: "destructive",
            });
        } else {
            setIsOpenGiveExtrasModal(true);
        }
    };

    const handleDnfAll = () => {
        if (openIncidents.length > 0) {
            toast({
                title: "Resolve the open incident first",
                variant: "destructive",
            });
        } else {
            setIsOpenDnfModal(true);
        }
    };

    const saveIncidentBeforeExtras = async (comment: string) => {
        const { status, message } = await updateAttempt({
            ...openIncident,
            comment,
            status: AttemptStatus.EXTRA_GIVEN,
        });
        return status === 200
            ? undefined
            : message ?? "An error occurred while updating the incident";
    };

    const resultAverage =
        submittedAttempts.length === maxAttempts
            ? average(submittedAttempts)
            : undefined;

    return (
        <div className="flex w-full flex-col gap-5">
            <SingleResultHeader
                result={result}
                fetchData={fetchData}
                onEnterAttempt={() => setIsOpenCreateAttemptModal(true)}
                standardAttempts={standardAttempts}
                maxAttempts={maxAttempts}
                onGiveExtras={
                    canGiveExtras && !isRemoved ? handleGiveExtras : undefined
                }
                onDnfAll={canDnfAll ? handleDnfAll : undefined}
                onRemove={
                    canRemove ? () => setIsOpenRemoveModal(true) : undefined
                }
                isRemoved={isRemoved}
            />

            {isRemoved && (
                <RemovedResultBanner
                    result={result}
                    onBroughtBack={fetchData}
                />
            )}

            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] items-start gap-3.5">
                <section
                    aria-label="Summary"
                    className="grid grid-cols-2 gap-3.5 rounded-mobile-card border bg-card px-5 py-[18px] md:rounded-2xl"
                >
                    <div>
                        <p className="text-xs font-semibold text-faint">
                            Average
                        </p>
                        <p className="mt-0.5 text-2xl font-bold">
                            {resultAverage
                                ? resultToString(resultAverage)
                                : "—"}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-faint">Best</p>
                        <p className="mt-0.5 text-2xl font-bold">
                            {formattedBest(submittedAttempts) || "—"}
                        </p>
                    </div>
                    <p className="col-span-2 text-[13px] text-muted-foreground">
                        {submittedAttempts.length} of {maxAttempts} attempts
                        entered
                    </p>
                </section>
                <WarningsAndLimitsCard
                    competition={competition}
                    result={result}
                    submittedAttempts={submittedAttempts}
                    limit={limit}
                    maxAttempts={maxAttempts}
                    remainingAndUsedCumulativeLimit={
                        remainingAndUsedCumulativeLimit!
                    }
                />
                <LastAttemptCard result={result} fetchData={fetchData} />
            </div>

            {extrasContext?.grant && (
                <ReplacedAttemptsCard
                    attempts={result.attempts}
                    grant={extrasContext.grant}
                    onSwitched={fetchData}
                />
            )}

            {dnfRuling &&
                (dnfRuling.attempts.length > 0 ||
                    dnfRuling.removedResults.length > 0) && (
                    <DnfRulingCard
                        resultId={result.id}
                        attempts={result.attempts}
                        ruling={dnfRuling}
                        onRestored={fetchData}
                    />
                )}

            <PageTabs
                label="Attempts"
                value={tab}
                onValueChange={setTab}
                tabs={[
                    {
                        value: "submitted",
                        label: "Submitted",
                        count: submittedAttempts.length,
                    },
                    {
                        value: "standard",
                        label: "Standard",
                        count: standardAttempts.length,
                    },
                    ...(extraAttempts.length > 0
                        ? [
                              {
                                  value: "extra" as Tab,
                                  label: "Extra attempts",
                                  count: extraAttempts.length,
                              },
                          ]
                        : []),
                    ...(isRemoved
                        ? []
                        : [
                              {
                                  value: "reorder" as Tab,
                                  label: "Reorder & extras",
                              },
                          ]),
                ]}
            />

            <section className="overflow-hidden rounded-mobile-card border bg-card md:rounded-2xl">
                {tab === "submitted" &&
                    (submittedAttempts.length === 0 ? (
                        <EmptyState className="border-0">
                            Nothing submitted to WCA Live yet.
                        </EmptyState>
                    ) : (
                        <div className="overflow-x-auto">
                            <AttemptsTable
                                attempts={submittedAttempts as never}
                                fetchData={fetchData}
                                result={result}
                            />
                        </div>
                    ))}
                {tab === "standard" &&
                    (standardAttempts.length === 0 ? (
                        <EmptyState className="border-0">
                            No attempts.
                        </EmptyState>
                    ) : (
                        <>
                            {!isRemoved && (
                                <div className="flex justify-end border-b p-3">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setIsOpenSwapAttemptsModal(true)
                                        }
                                    >
                                        Swap attempts
                                    </Button>
                                </div>
                            )}
                            <div className="overflow-x-auto">
                                <AttemptsTable
                                    attempts={standardAttempts}
                                    showExtraColumns
                                    fetchData={fetchData}
                                    result={result}
                                />
                            </div>
                        </>
                    ))}
                {tab === "extra" && (
                    <div className="overflow-x-auto">
                        <AttemptsTable
                            attempts={extraAttempts}
                            fetchData={fetchData}
                            result={result}
                            showExtraColumns
                        />
                    </div>
                )}
                {tab === "reorder" &&
                    (standardAttempts.length === 0 ? (
                        <EmptyState className="border-0">
                            No attempts.
                        </EmptyState>
                    ) : (
                        <div className="p-4 md:p-5">
                            <AttemptsReorderBoard
                                result={result}
                                standardAttempts={standardAttempts}
                                extraAttempts={extraAttempts}
                                fetchData={fetchData}
                            />
                        </div>
                    ))}
            </section>

            <CreateAttemptModal
                isOpen={isOpenCreateAttemptModal}
                onClose={handleCloseModal}
                roundId={result.roundId}
                competitorId={result.person.id}
                existingAttempts={result.attempts}
                timeLimit={limit!}
            />
            <SwapAttemptsModal
                isOpen={isOpenSwapAttemptsModal}
                onClose={handleCloseModal}
                attempts={standardAttempts}
            />
            {isOpenGiveExtrasModal && (
                <GiveExtrasModal
                    isOpen
                    onClose={handleCloseModal}
                    onDone={handleCloseModal}
                    resultId={result.id}
                    roundId={result.roundId}
                    personName={result.person.name}
                    attempts={result.attempts}
                    lockedAttempt={openIncident}
                    beforeGrant={
                        openIncident ? saveIncidentBeforeExtras : undefined
                    }
                />
            )}
            {isOpenDnfModal && (
                <DnfAttemptsModal
                    isOpen
                    onClose={handleCloseModal}
                    onDone={handleCloseModal}
                    personName={result.person.name}
                    results={[result]}
                    eventResults={eventResults}
                />
            )}
            {isOpenRemoveModal && (
                <RemoveResultModal
                    isOpen
                    onClose={handleCloseModal}
                    onDone={handleCloseModal}
                    resultId={result.id}
                    roundId={result.roundId}
                    personName={result.person.name}
                />
            )}
        </div>
    );
};

export default SingleResult;
