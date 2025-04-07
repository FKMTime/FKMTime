import { useAtomValue } from "jotai";
import { Heading } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import EventIcon from "@/Components/Icons/EventIcon";
import LoadingPage from "@/Components/LoadingPage";
import { Alert, AlertTitle } from "@/Components/ui/alert";
import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";
import { Attempt, Result, ResultToDoubleCheck } from "@/lib/interfaces";
import {
    doubleCheckResult,
    getResultsToDoubleCheckByRoundId,
    undoDoubleCheck,
} from "@/lib/results";
import { getSubmissionPlatformName } from "@/lib/utils";
import PageTransition from "@/Pages/PageTransition";

import AttemptsList from "./Components/AttemptsList";
import DoubleCheckActions from "./Components/DoubleCheckActions";
import DoubleCheckFinished from "./Components/DoubleCheckFinished";
import SelectCompetitor from "./Components/SelectCompetitor";

const DoubleCheck = () => {
    const { id } = useParams<{ id: string }>();
    const confirm = useConfirm();
    const { toast } = useToast();
    const [resultsToDoubleCheck, setResultsToDoubleCheck] = useState<
        ResultToDoubleCheck[]
    >([]);
    const [inputValue, setInputValue] = useState<string>("");
    const [result, setResult] = useState<ResultToDoubleCheck | null>(null);
    const [totalResults, setTotalResults] = useState<number>(0);
    const [doubleCheckedResults, setDoubleCheckedResults] = useState<number>(0);
    const [justSelected, setJustSelected] = useState<boolean>(false);
    const roundName = activityCodeToName(id || "");
    const competition = useAtomValue(competitionAtom);
    const idInputRef = useRef<HTMLInputElement>(null);

    const fetchData = useCallback(async () => {
        if (!id) return;
        const data = await getResultsToDoubleCheckByRoundId(id);
        const resultsToSet = data.results.map((r: Result) => {
            return {
                ...r,
                combinedName: `${r.person.name} (${r.person.registrantId})`,
            };
        });
        setResultsToDoubleCheck(resultsToSet);
        setTotalResults(data.totalCount);
        setDoubleCheckedResults(data.doubleCheckedCount);
    }, [id]);

    useEffect(() => {
        fetchData();
    }, [fetchData, id]);

    const handleUpdateAttempt = (attempt: Attempt) => {
        if (!result) return;
        const updatedAttempts = result.attempts.map((a) =>
            a.id === attempt.id ? attempt : a
        );
        setResult({ ...result, attempts: updatedAttempts });
    };

    const submitDoubleCheckedResult = useCallback(async () => {
        if (!result) return;
        const status = await doubleCheckResult(result.id, result.attempts);
        if (status === 200) {
            toast({
                title: "Successfully double checked result.",
                variant: "success",
            });
            setResult(null);
            setInputValue("");
            fetchData();
            idInputRef.current?.focus();
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
        }
    }, [fetchData, result, toast]);

    const handleSubmit = useCallback(async () => {
        if (!result) return;
        const originalResult = resultsToDoubleCheck.find(
            (r) => r.id === result.id
        );
        let hasChanged = false;
        originalResult?.attempts.forEach((a) => {
            const currentAttempt = result.attempts.find((ca) => ca.id === a.id);
            if (currentAttempt) {
                if (
                    a.value !== currentAttempt.value ||
                    a.penalty !== currentAttempt.penalty
                ) {
                    hasChanged = true;
                }
            }
        });
        if (hasChanged) {
            confirm({
                title: `Are you sure you want to save and resubmit this result to ${getSubmissionPlatformName(result.eventId)}?`,
                description: "You changed some times/penalties",
            })
                .then(async () => {
                    await submitDoubleCheckedResult();
                })
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
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [handleSubmit, justSelected]);

    if (!resultsToDoubleCheck || !id) return <LoadingPage />;

    return (
        <PageTransition>
            <div className="flex flex-col gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <EventIcon
                                eventId={id.split("-r")[0]}
                                size={20}
                                selected
                            />
                            {roundName} - {doubleCheckedResults}/{totalResults}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        {doubleCheckedResults === totalResults ? (
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
                                    <AlertTitle>
                                        Clicking enter on the ID field will mark
                                        result as double-checked
                                    </AlertTitle>
                                </Alert>
                                <Alert>
                                    <AlertTitle>
                                        If you want to make more changes please
                                        go to Details page
                                    </AlertTitle>
                                </Alert>
                                <Alert variant="warning">
                                    <AlertTitle>
                                        When double-checking, focus on the final
                                        time, which is located in the{" "}
                                        <span className="font-bold">
                                            Result
                                        </span>{" "}
                                        column
                                    </AlertTitle>
                                </Alert>
                                {resultsToDoubleCheck ? (
                                    <SelectCompetitor
                                        idInputRef={idInputRef}
                                        handleSubmit={handleSubmit}
                                        resultsToDoubleCheck={
                                            resultsToDoubleCheck
                                        }
                                        setResult={setResult}
                                        inputValue={inputValue}
                                        setJustSelected={setJustSelected}
                                        setInputValue={setInputValue}
                                    />
                                ) : (
                                    <Heading>
                                        No results to double check
                                    </Heading>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>

                {result && (
                    <Card>
                        <CardHeader>
                            <CardTitle>
                                {result.person.name} (
                                {result.person.registrantId})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            {competition && (
                                <AttemptsList
                                    result={result}
                                    competition={competition}
                                    updateAttempt={handleUpdateAttempt}
                                />
                            )}
                            <DoubleCheckActions
                                handleSubmit={handleSubmit}
                                handleSkip={handleSkip}
                                result={result}
                            />
                        </CardContent>
                    </Card>
                )}
            </div>
        </PageTransition>
    );
};

export default DoubleCheck;
