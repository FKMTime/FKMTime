import { useAtomValue } from "jotai";
import { CircleCheck, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import AttemptWarnings from "@/Components/AttemptWarnings";
import LoadingPage from "@/Components/LoadingPage";
import EmptyState from "@/Components/shared/EmptyState";
import ProgressBar from "@/Components/shared/ProgressBar";
import { StatusDot } from "@/Components/shared/StatusBadge";
import { Button } from "@/Components/ui/button";
import { useConfirm } from "@/hooks/useConfirm";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useToast } from "@/hooks/useToast";
import { competitionAtom } from "@/lib/atoms";
import { roundIncidentsQuery } from "@/lib/incidents";
import {
    Attempt,
    Incident,
    Person,
    RemainingAndUsedCumulativeLimit,
    Result,
    ResultToDoubleCheck,
} from "@/lib/interfaces";
import { attemptWithPenaltyToString } from "@/lib/resultFormatters";
import {
    doubleCheckQuery,
    doubleCheckResult,
    getPersonsWithNoResultsByRoundId,
    resultQuery,
    undoDoubleCheck,
} from "@/lib/results";
import { getSubmissionPlatformName } from "@/lib/utils";

import RoundSubpageHeader from "../Components/RoundSubpageHeader";
import MissingPersonsModal from "./Components/MissingPersonsModal";
import ResultCheckCard from "./Components/ResultCheckCard";
import SelectCompetitor from "./Components/SelectCompetitor";

interface CheckedResult {
    id: string;
    person: Person;
}

const DoubleCheck = () => {
    const { id } = useParams<{ id: string }>();
    const confirm = useConfirm();
    const { toast } = useToast();
    const roundId = id ?? "";
    const { data: roundData, refetch: refetchRound } = useLiveQuery(
        doubleCheckQuery(roundId),
        { enabled: !!id }
    );
    const { data: incidentsData, refetch: refetchIncidents } = useLiveQuery(
        roundIncidentsQuery(roundId),
        { enabled: !!id }
    );
    const resultsToDoubleCheck: ResultToDoubleCheck[] = useMemo(
        () =>
            (roundData?.results ?? []).map((r: Result) => ({
                ...r,
                combinedName: `${r.person.name} (${r.person.registrantId})`,
            })),
        [roundData]
    );
    const checkedResults: CheckedResult[] = roundData?.checkedResults ?? [];
    const totalResults = roundData?.totalCount ?? 0;
    const doubleCheckedResults = roundData?.doubleCheckedCount ?? 0;
    const incidents: Incident[] = incidentsData ?? [];
    const [inputValue, setInputValue] = useState<string>("");
    const [result, setResult] = useState<ResultToDoubleCheck | null>(null);
    const [alreadyCheckedResult, setAlreadyCheckedResult] =
        useState<CheckedResult | null>(null);
    const [justSelected, setJustSelected] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [missingPersons, setMissingPersons] = useState<
        Pick<Person, "id" | "name" | "registrantId" | "wcaId">[]
    >([]);
    const [showMissingPersons, setShowMissingPersons] = useState(false);
    const competition = useAtomValue(competitionAtom);
    const idInputRef = useRef<HTMLInputElement>(null);

    const fetchData = useCallback(
        () => Promise.all([refetchRound(), refetchIncidents()]),
        [refetchRound, refetchIncidents]
    );

    // The selected result's cumulative time limit, from the saved attempts
    const { data: selectedResult } = useLiveQuery(
        resultQuery(result?.id ?? ""),
        { enabled: !!result }
    );
    const cumulativeLimit: RemainingAndUsedCumulativeLimit | null = result
        ? selectedResult?.remainingAndUsedCumulativeLimit ?? null
        : null;

    const handleUpdateAttempt = (attempt: Attempt) => {
        if (!result) return;
        setResult({
            ...result,
            attempts: result.attempts.map((a) =>
                a.id === attempt.id ? attempt : a
            ),
        });
    };

    const submitDoubleCheckedResult = useCallback(async () => {
        if (!result) return;
        setIsSubmitting(true);
        try {
            const status = await doubleCheckResult(result.id, result.attempts);
            if (status === 200) {
                setResult(null);
                setAlreadyCheckedResult(null);
                setInputValue("");
                await fetchData();
                window.scrollTo({ top: 0, behavior: "smooth" });
                idInputRef.current?.focus();
            } else {
                toast({
                    title: "Error",
                    description: "Something went wrong",
                    variant: "destructive",
                });
            }
        } finally {
            setIsSubmitting(false);
        }
    }, [fetchData, result, toast]);

    const handleSubmit = useCallback(async () => {
        if (!result) return;
        const originalResult = resultsToDoubleCheck.find(
            (r) => r.id === result.id
        );
        const hasChanged =
            originalResult?.attempts.some((a) => {
                const current = result.attempts.find((ca) => ca.id === a.id);
                return (
                    current &&
                    (a.value !== current.value || a.penalty !== current.penalty)
                );
            }) ?? false;

        if (hasChanged) {
            confirm({
                title: `Are you sure you want to save and resubmit this result to ${getSubmissionPlatformName(result.eventId)}?`,
                description: "You changed some times/penalties",
            })
                .then(submitDoubleCheckedResult)
                .catch(() => {
                    // Declined: closing the dialog is feedback enough
                });
        } else {
            await submitDoubleCheckedResult();
        }
    }, [confirm, result, resultsToDoubleCheck, submitDoubleCheckedResult]);

    const handleSkip = () => {
        setResult(null);
        setAlreadyCheckedResult(null);
        setInputValue("");
        idInputRef.current?.focus();
    };

    const handleUndoDoubleCheck = async () => {
        if (!id) return;
        confirm({
            title: "Mark results as not double checked",
            description:
                "Are you sure you want to mark all results as not double checked?",
        })
            .then(async () => {
                const status = await undoDoubleCheck(id);
                if (status === 204) {
                    fetchData();
                } else {
                    toast({
                        title: "Error",
                        description: "Something went wrong",
                        variant: "destructive",
                    });
                }
            })
            .catch(() => {
                // Declined: closing the dialog is feedback enough
            });
    };

    const handleShowMissingPersons = async () => {
        if (!id) return;
        const persons = await getPersonsWithNoResultsByRoundId(id);
        setMissingPersons(persons);
        setShowMissingPersons(true);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (
                e.key === "Enter" &&
                !(idInputRef.current === document.activeElement)
            ) {
                if (!justSelected) handleSubmit();
                else setJustSelected(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleSubmit, justSelected]);

    if (!resultsToDoubleCheck || !id) return <LoadingPage />;

    const isFinished =
        doubleCheckedResults === totalResults && totalResults > 0;

    return (
        <div className="flex flex-col gap-5">
            <RoundSubpageHeader
                roundId={id}
                title="Double check"
                aside={
                    <div className="flex w-full items-center gap-3 md:w-56 md:flex-col md:items-stretch md:gap-1.5">
                        <p className="shrink-0 text-sm text-muted-foreground">
                            <b className="font-semibold text-foreground md:text-lg">
                                {doubleCheckedResults}
                            </b>{" "}
                            / {totalResults} double-checked
                        </p>
                        <ProgressBar
                            className="flex-1 md:flex-none"
                            value={doubleCheckedResults}
                            max={totalResults}
                            label="Double-checked results"
                        />
                    </div>
                }
            />

            {isFinished ? (
                <section className="flex flex-col items-center gap-3 rounded-mobile-card border bg-card px-6 py-12 text-center md:rounded-2xl">
                    <CircleCheck className="size-10 text-success" />
                    <h3 className="text-lg font-bold">
                        All {totalResults} results double-checked
                    </h3>
                    <Button
                        variant="destructive-ghost"
                        onClick={handleUndoDoubleCheck}
                    >
                        Mark results as not double checked
                    </Button>
                </section>
            ) : (
                // Phones: input, then the scorecard right under it, then the
                // rest. Wide screens: input and the rest left, scorecard right
                <div className="grid grid-cols-1 items-start gap-3 md:gap-5 lg:grid-cols-2 lg:grid-rows-[auto_1fr]">
                    <div className="flex min-w-0 flex-col gap-1.5">
                        <span className="hidden text-[13px] font-semibold text-muted-foreground md:block">
                            Competitor ID
                        </span>
                        <SelectCompetitor
                            idInputRef={idInputRef}
                            handleSubmit={handleSubmit}
                            resultsToDoubleCheck={resultsToDoubleCheck}
                            checkedResults={checkedResults}
                            setResult={setResult}
                            setAlreadyCheckedResult={setAlreadyCheckedResult}
                            inputValue={inputValue}
                            setJustSelected={setJustSelected}
                            setInputValue={setInputValue}
                        />
                    </div>

                    <div className="flex min-w-0 flex-col gap-3.5 max-lg:order-last max-lg:mt-2">
                        <p className="hidden text-[13px] text-muted-foreground md:block">
                            Press Enter again to confirm the result. Use Details
                            for full editing.
                        </p>
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-fit"
                            onClick={handleShowMissingPersons}
                        >
                            <Users />
                            Missing competitors
                        </Button>
                        {incidents.length > 0 && (
                            <div className="flex flex-col gap-1.5 border-t pt-3">
                                <span className="text-xs font-semibold text-faint">
                                    Open incidents in this round
                                </span>
                                {incidents.map((incident) => (
                                    <div
                                        key={incident.id}
                                        className="flex flex-wrap items-center gap-x-2 gap-y-1"
                                    >
                                        <Link
                                            to={`/incidents/${incident.id}`}
                                            className="-mx-2 flex items-center gap-2 rounded-lg px-2 py-1 text-sm transition-colors hover:bg-accent"
                                        >
                                            <StatusDot tone="destructive" />
                                            <span className="font-semibold">
                                                {incident.result.person.name}
                                            </span>
                                            <span className="text-muted-foreground">
                                                {[
                                                    `Attempt ${incident.attemptNumber}`,
                                                    attemptWithPenaltyToString(
                                                        incident
                                                    ),
                                                    incident.device?.name,
                                                ]
                                                    .filter(Boolean)
                                                    .join(" · ")}
                                            </span>
                                        </Link>
                                        <AttemptWarnings attempt={incident} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
                        {result && competition ? (
                            <ResultCheckCard
                                result={result}
                                competition={competition}
                                cumulativeLimit={cumulativeLimit}
                                isSubmitting={isSubmitting}
                                updateAttempt={handleUpdateAttempt}
                                onConfirm={handleSubmit}
                                onSkip={handleSkip}
                            />
                        ) : alreadyCheckedResult ? (
                            <section className="flex flex-col gap-3.5 rounded-mobile-card border bg-card p-4 md:rounded-2xl md:p-[22px]">
                                <h3 className="text-lg font-bold">
                                    {alreadyCheckedResult.person.name}{" "}
                                    <span className="font-medium text-faint">
                                        (
                                        {
                                            alreadyCheckedResult.person
                                                .registrantId
                                        }
                                        )
                                    </span>
                                </h3>
                                <p className="rounded-chip bg-success-soft px-3 py-2.5 text-sm font-semibold text-success">
                                    This scorecard has already been
                                    double-checked.
                                </p>
                                <div className="flex gap-2">
                                    <Button variant="outline" asChild>
                                        <Link
                                            to={`/results/${alreadyCheckedResult.id}`}
                                        >
                                            Open scorecard
                                        </Link>
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        onClick={handleSkip}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </section>
                        ) : (
                            <EmptyState className="min-h-32 md:min-h-[220px]">
                                Enter the ID from the next scorecard.
                            </EmptyState>
                        )}
                    </div>
                </div>
            )}

            <MissingPersonsModal
                isOpen={showMissingPersons}
                onClose={() => setShowMissingPersons(false)}
                persons={missingPersons}
            />
        </div>
    );
};

export default DoubleCheck;
