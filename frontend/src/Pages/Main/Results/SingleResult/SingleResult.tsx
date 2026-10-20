import { useAtom } from "jotai";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getLimitByRoundId, getNumberOfAttemptsForRound } from "wcif-helpers";

import LoadingPage from "@/Components/LoadingPage";
import EmptyState from "@/Components/shared/EmptyState";
import PageTabs from "@/Components/shared/PageTabs";
import { Button } from "@/Components/ui/button";
import { usePageHeader } from "@/hooks/usePageHeader";
import { useToast } from "@/hooks/useToast";
import { competitionAtom } from "@/lib/atoms";
import { average, formattedBest } from "@/lib/average";
import { getCompetitionInfo } from "@/lib/competition";
import { RemainingAndUsedCumulativeLimit, Result } from "@/lib/interfaces";
import { resultToString } from "@/lib/resultFormatters";
import { getResultById } from "@/lib/results";
import { getSubmittedAttempts, shortRoundName } from "@/lib/utils";

import CreateAttemptModal from "../Components/CreateAttemptModal";
import AttemptsReorderBoard from "./Components/AttemptsReorderBoard";
import AttemptsTable from "./Components/AttemptsTable";
import LastAttemptCard from "./Components/LastAttemptCard";
import SingleResultHeader from "./Components/SingleResultHeader";
import SwapAttemptsModal from "./Components/SwapAttemptsModal";
import WarningsAndLimitsCard from "./Components/WarningsAndLimitsCard";

type Tab = "submitted" | "standard" | "extra" | "reorder";

const SingleResult = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [competition, setCompetition] = useAtom(competitionAtom);
    const [result, setResult] = useState<Result | null>(null);
    const [isOpenCreateAttemptModal, setIsOpenCreateAttemptModal] =
        useState<boolean>(false);
    const [isOpenSwapAttemptsModal, setIsOpenSwapAttemptsModal] =
        useState<boolean>(false);
    const [tab, setTab] = useState<Tab>("submitted");
    const [
        remainingAndUsedCumulativeLimit,
        setRemainingAndUsedCumulativeLimit,
    ] = useState<RemainingAndUsedCumulativeLimit | null>(null);
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

    const fetchData = useCallback(async () => {
        if (!id) return;
        if (!competition) {
            const competitionData = await getCompetitionInfo();
            setCompetition(competitionData.data);
        }
        const response = await getResultById(id);
        if (response.status === 404) {
            toast({
                title: "Error",
                description: "Result not found",
                variant: "destructive",
            });
            navigate("/results");
        }
        setResult(response.data);
        setRemainingAndUsedCumulativeLimit(
            response.data.remainingAndUsedCumulativeLimit
        );
    }, [competition, id, navigate, setCompetition, toast]);

    const handleCloseModal = () => {
        fetchData();
        setIsOpenCreateAttemptModal(false);
        setIsOpenSwapAttemptsModal(false);
    };

    useEffect(() => {
        fetchData();
    }, [fetchData]);

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
            />

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
                    { value: "reorder", label: "Reorder & extras" },
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
                timeLimit={limit!}
            />
            <SwapAttemptsModal
                isOpen={isOpenSwapAttemptsModal}
                onClose={handleCloseModal}
                attempts={standardAttempts}
            />
        </div>
    );
};

export default SingleResult;
