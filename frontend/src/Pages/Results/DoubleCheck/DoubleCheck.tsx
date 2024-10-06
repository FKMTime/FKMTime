import {
    Alert,
    AlertIcon,
    Box,
    Button,
    Heading,
    useToast,
} from "@chakra-ui/react";
import { useConfirm } from "chakra-ui-confirm";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import { activityCodeToName } from "@/logic/activities";
import { competitionAtom } from "@/logic/atoms";
import { Attempt, Result, ResultToDoubleCheck } from "@/logic/interfaces";
import {
    doubleCheckResult,
    getResultsToDoubleCheckByRoundId,
    undoDoubleCheck,
} from "@/logic/results";
import { getSubmissionPlatformName } from "@/logic/utils";

import AttemptsList from "./Components/AttemptsList";
import DoubleCheckActions from "./Components/DoubleCheckActions";
import DoubleCheckFinished from "./Components/DoubleCheckFinished";
import SelectCompetitor from "./Components/SelectCompetitor";

const DoubleCheck = () => {
    const { id } = useParams<{ id: string }>();
    const confirm = useConfirm();
    const toast = useToast();
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
                status: "success",
            });
            setResult(null);
            setInputValue("");
            fetchData();
            idInputRef.current?.focus();
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                status: "error",
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
                        status: "info",
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
                        status: "success",
                    });
                    fetchData();
                } else {
                    toast({
                        title: "Error",
                        description: "Something went wrong",
                        status: "error",
                    });
                }
            })
            .catch(() => {
                toast({
                    title: "Cancelled",
                    description: "You have cancelled the undoing.",
                    status: "info",
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
        <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            gap={5}
            textAlign="center"
        >
            <Heading>
                {roundName} - {doubleCheckedResults}/{totalResults}
            </Heading>
            {doubleCheckedResults === totalResults ? (
                <>
                    <DoubleCheckFinished
                        totalResults={totalResults}
                        roundId={id}
                    />
                    <Button colorScheme="red" onClick={handleUndoDoubleCheck}>
                        Mark results as not double checked
                    </Button>
                </>
            ) : (
                <>
                    <Alert status="info" color="black" width="fit-content">
                        <AlertIcon />
                        Clicking enter on the ID field will mark result as
                        double-checked
                    </Alert>
                    {resultsToDoubleCheck ? (
                        <SelectCompetitor
                            idInputRef={idInputRef}
                            handleSubmit={handleSubmit}
                            result={result}
                            resultsToDoubleCheck={resultsToDoubleCheck}
                            setResult={setResult}
                            inputValue={inputValue}
                            setJustSelected={setJustSelected}
                            setInputValue={setInputValue}
                        />
                    ) : (
                        <Heading>No results to double check</Heading>
                    )}
                    {result && (
                        <>
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
                        </>
                    )}
                </>
            )}
        </Box>
    );
};

export default DoubleCheck;
