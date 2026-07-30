import { useAtomValue } from "jotai";
import { AlertTriangle, ChevronRight, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    getCutoffByRoundId,
    getLimitByRoundId,
    getNumberOfAttemptsForRound,
} from "wcif-helpers";

import AttemptWarnings from "@/Components/AttemptWarnings";
import EventIcon from "@/Components/Icons/EventIcon";
import LoadingPage from "@/Components/LoadingPage";
import { Alert, AlertTitle } from "@/Components/ui/alert";
import { Button } from "@/Components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/Components/ui/card";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";
import { getIncidentsByRoundId } from "@/lib/incidents";
import {
    Attempt,
    Incident,
    Person,
    RemainingAndUsedCumulativeLimit,
    Result,
    ResultToDoubleCheck,
} from "@/lib/interfaces";
import {
    attemptWithPenaltyToString,
    resultToString,
} from "@/lib/resultFormatters";
import {
    doubleCheckResult,
    getPersonsWithNoResultsByRoundId,
    getResultById,
    getResultsToDoubleCheckByRoundId,
    undoDoubleCheck,
} from "@/lib/results";
import { getSubmissionPlatformName } from "@/lib/utils";
import PageTransition from "@/Pages/PageTransition";

import AttemptsList from "./Components/AttemptsList";
import DoubleCheckActions from "./Components/DoubleCheckActions";
import DoubleCheckFinished from "./Components/DoubleCheckFinished";
import MissingPersonsModal from "./Components/MissingPersonsModal";
import SelectCompetitor from "./Components/SelectCompetitor";

interface CheckedResult {
    id: string;
    person: Person;
}

const DoubleCheck = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const confirm = useConfirm();
    const { toast } = useToast();
    const [resultsToDoubleCheck, setResultsToDoubleCheck] = useState<
        ResultToDoubleCheck[]
    >([]);
    const [checkedResults, setCheckedResults] = useState<CheckedResult[]>([]);
    const [inputValue, setInputValue] = useState<string>("");
    const [result, setResult] = useState<ResultToDoubleCheck | null>(null);
    const [alreadyCheckedResult, setAlreadyCheckedResult] =
        useState<CheckedResult | null>(null);
    const [totalResults, setTotalResults] = useState<number>(0);
    const [doubleCheckedResults, setDoubleCheckedResults] = useState<number>(0);
    const [justSelected, setJustSelected] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [missingPersons, setMissingPersons] = useState<
        Pick<Person, "id" | "name" | "registrantId" | "wcaId">[]
    >([]);
    const [showMissingPersons, setShowMissingPersons] = useState(false);
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [cumulativeLimit, setCumulativeLimit] =
        useState<RemainingAndUsedCumulativeLimit | null>(null);
    const roundName = activityCodeToName(id || "");
    const competition = useAtomValue(competitionAtom);
    const idInputRef = useRef<HTMLInputElement>(null);

    const limit =
        id && competition ? getLimitByRoundId(id, competition.wcif) : null;
    const cutoff =
        id && competition ? getCutoffByRoundId(id, competition.wcif) : null;
    const maxAttempts =
        id && competition
            ? getNumberOfAttemptsForRound(id, competition.wcif)
            : 0;

    const fetchData = useCallback(async () => {
        if (!id) return;
        const [data, checks] = await Promise.all([
            getResultsToDoubleCheckByRoundId(id),
            getIncidentsByRoundId(id),
        ]);
        setResultsToDoubleCheck(
            data.results.map((r: Result) => ({
                ...r,
                combinedName: `${r.person.name} (${r.person.registrantId})`,
            }))
        );
        setCheckedResults(data.checkedResults ?? []);
        setTotalResults(data.totalCount);
        setDoubleCheckedResults(data.doubleCheckedCount);
        setIncidents(checks);
    }, [id]);

    useEffect(() => {
        fetchData();
    }, [fetchData, id]);

    useEffect(() => {
        if (!result) {
            setCumulativeLimit(null);
            return;
        }
        getResultById(result.id).then((r) =>
            setCumulativeLimit(r.data.remainingAndUsedCumulativeLimit ?? null)
        );
    }, [result]);

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
                toast({
                    title: "Successfully double checked result.",
                    variant: "success",
                });
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
                    toast({
                        title: "Cancelled",
                        description:
                            "You have cancelled the resubmission of the result.",
                    });
                });
        } else {
            await submitDoubleCheckedResult();
        }
    }, [
        confirm,
        result,
        resultsToDoubleCheck,
        submitDoubleCheckedResult,
        toast,
    ]);

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
                    toast({
                        title: "Successfully marked results as not double checked.",
                        variant: "success",
                    });
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
                toast({
                    title: "Cancelled",
                    description: "You have cancelled the undoing.",
                });
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

    const progress =
        totalResults > 0
            ? Math.round((doubleCheckedResults / totalResults) * 100)
            : 0;
    const isFinished =
        doubleCheckedResults === totalResults && totalResults > 0;

    return (
        <PageTransition>
            <div className="flex flex-col gap-4">
                {/* Progress bar */}
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                        className="h-2 rounded-full bg-primary transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <div className="flex flex-col md:flex-row gap-4 items-stretch">
                    {/* Left card: input / finished state */}
                    <Card className="w-full md:flex-1">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <EventIcon
                                    eventId={id.split("-r")[0]}
                                    size={20}
                                    selected
                                />
                                {roundName}
                            </CardTitle>
                            <CardDescription>
                                {doubleCheckedResults} / {totalResults}{" "}
                                double-checked
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3">
                            {isFinished ? (
                                <>
                                    <DoubleCheckFinished
                                        totalResults={totalResults}
                                        roundId={id}
                                    />
                                    <Button
                                        variant="destructive"
                                        className="w-fit"
                                        onClick={handleUndoDoubleCheck}
                                    >
                                        Mark results as NOT double checked
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Alert>
                                        <AlertTitle className="text-sm">
                                            Enter an ID and press Enter to mark
                                            as double-checked. Go to Details for
                                            full editing.
                                        </AlertTitle>
                                    </Alert>

                                    {(limit || cutoff) && (
                                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 border rounded-md px-3 py-2">
                                            {cutoff && (
                                                <span>
                                                    Cutoff:{" "}
                                                    <span className="font-medium text-foreground">
                                                        {resultToString(
                                                            cutoff.resultValue
                                                        )}{" "}
                                                        (
                                                        {
                                                            cutoff.numberOfAttempts
                                                        }{" "}
                                                        att.)
                                                    </span>
                                                </span>
                                            )}
                                            {limit && (
                                                <span>
                                                    Limit:{" "}
                                                    <span className="font-medium text-foreground">
                                                        {resultToString(
                                                            limit.centiseconds
                                                        )}
                                                        {limit
                                                            .cumulativeRoundIds
                                                            .length > 0
                                                            ? " (cumulative)"
                                                            : ""}
                                                    </span>
                                                </span>
                                            )}
                                            <span>
                                                Attempts:{" "}
                                                <span className="font-medium text-foreground">
                                                    {maxAttempts}
                                                </span>
                                            </span>
                                        </div>
                                    )}

                                    <SelectCompetitor
                                        idInputRef={idInputRef}
                                        handleSubmit={handleSubmit}
                                        resultsToDoubleCheck={
                                            resultsToDoubleCheck
                                        }
                                        checkedResults={checkedResults}
                                        setResult={setResult}
                                        setAlreadyCheckedResult={
                                            setAlreadyCheckedResult
                                        }
                                        inputValue={inputValue}
                                        setJustSelected={setJustSelected}
                                        setInputValue={setInputValue}
                                    />

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-fit"
                                        onClick={handleShowMissingPersons}
                                    >
                                        <Users size={14} />
                                        Missing competitors
                                    </Button>

                                    {incidents.length > 0 && (
                                        <div className="hidden md:flex flex-col gap-1 pt-2 border-t">
                                            <p className="text-sm font-semibold flex items-center gap-1.5 mb-1">
                                                <AlertTriangle size={14} />
                                                Incidents ({incidents.length})
                                            </p>
                                            {incidents.map((incident) => (
                                                <div
                                                    key={incident.id}
                                                    className="group flex items-center justify-between text-sm cursor-pointer hover:bg-muted/60 rounded px-1 -mx-1 py-1 transition-colors"
                                                    onClick={() =>
                                                        navigate(
                                                            `/incidents/${incident.id}`
                                                        )
                                                    }
                                                >
                                                    <div className="flex flex-col gap-0.5 min-w-0">
                                                        <span className="font-medium truncate">
                                                            {
                                                                incident.result
                                                                    .person.name
                                                            }
                                                        </span>
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                                            <span>
                                                                A
                                                                {
                                                                    incident.attemptNumber
                                                                }
                                                                :{" "}
                                                                {attemptWithPenaltyToString(
                                                                    incident
                                                                )}
                                                            </span>
                                                            <div className="flex gap-1">
                                                                <AttemptWarnings
                                                                    attempt={
                                                                        incident
                                                                    }
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <ChevronRight
                                                        size={14}
                                                        className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Right: result card or already-checked message */}
                    {alreadyCheckedResult && !result && (
                        <Card className="w-full md:flex-1">
                            <CardHeader>
                                <CardTitle className="text-base">
                                    {alreadyCheckedResult.person.name} (
                                    {alreadyCheckedResult.person.registrantId})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3">
                                <Alert variant="success">
                                    <AlertTitle>
                                        This scorecard has already been
                                        double-checked.
                                    </AlertTitle>
                                </Alert>
                                <Button
                                    className="w-fit"
                                    onClick={() =>
                                        navigate(
                                            `/results/${alreadyCheckedResult.id}`
                                        )
                                    }
                                >
                                    Go back to this scorecard
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {result && competition && (
                        <Card className="w-full md:flex-1">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">
                                    {result.person.name} (
                                    {result.person.registrantId})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-4">
                                <AttemptsList
                                    result={result}
                                    competition={competition}
                                    updateAttempt={handleUpdateAttempt}
                                    cumulativeLimit={cumulativeLimit}
                                />
                                <DoubleCheckActions
                                    handleSubmit={handleSubmit}
                                    handleSkip={handleSkip}
                                    result={result}
                                    isSubmitting={isSubmitting}
                                />
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            <MissingPersonsModal
                isOpen={showMissingPersons}
                onClose={() => setShowMissingPersons(false)}
                persons={missingPersons}
            />
        </PageTransition>
    );
};

export default DoubleCheck;
