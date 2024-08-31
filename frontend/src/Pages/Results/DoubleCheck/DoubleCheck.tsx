import {
    Alert,
    AlertIcon,
    Box,
    Button,
    ButtonGroup,
    DarkMode,
    FormControl,
    Heading,
    Input,
    useToast,
} from "@chakra-ui/react";
import {
    AutoComplete,
    AutoCompleteInput,
    AutoCompleteItem,
    AutoCompleteList,
} from "@choc-ui/chakra-autocomplete";
import { useConfirm } from "chakra-ui-confirm";
import { useAtomValue } from "jotai";
import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

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
import DoubleCheckFinished from "./Components/DoubleCheckFinished";

const DoubleCheck = () => {
    const { id } = useParams<{ id: string }>();
    const confirm = useConfirm();
    const navigate = useNavigate();
    const toast = useToast();
    const [resultsToDoubleCheck, setResultsToDoubleCheck] = useState<
        ResultToDoubleCheck[]
    >([]);
    const [inputValue, setInputValue] = useState<string>("");
    const [result, setResult] = useState<ResultToDoubleCheck | null>(null);
    const [totalResults, setTotalResults] = useState<number>(0);
    const [doubleCheckedResults, setDoubleCheckedResults] = useState<number>(0);
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

    const handleSelect = (value: string) => {
        const selectedResult = resultsToDoubleCheck.find((r) => r.id === value);
        if (selectedResult) {
            setResult(selectedResult);
            setInputValue(selectedResult.person.registrantId?.toString() || "");
        }
    };

    const handleChangeIdInput = (event: ChangeEvent<HTMLInputElement>) => {
        setInputValue(event.target.value);
        const selectedResult = resultsToDoubleCheck.find(
            (r) => r.person.registrantId === +event.target.value
        );
        setResult(selectedResult || null);
    };

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
            if (e.key === "Enter") {
                handleSubmit();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [handleSubmit]);

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
                        <Box display="flex" gap={3}>
                            <Input
                                placeholder="ID"
                                width="20%"
                                autoFocus
                                ref={idInputRef}
                                _placeholder={{
                                    color: "gray.200",
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        handleSubmit();
                                    }
                                }}
                                value={inputValue}
                                onChange={handleChangeIdInput}
                            />
                            <DarkMode>
                                <FormControl>
                                    <AutoComplete
                                        openOnFocus
                                        onChange={handleSelect}
                                        value={result?.id || ""}
                                    >
                                        <AutoCompleteInput
                                            placeholder="Search"
                                            _placeholder={{
                                                color: "gray.200",
                                            }}
                                            borderColor="white"
                                        />
                                        <AutoCompleteList>
                                            {resultsToDoubleCheck.map((r) => (
                                                <AutoCompleteItem
                                                    key={r.id}
                                                    value={r.id}
                                                    label={r.combinedName}
                                                >
                                                    {r.combinedName}
                                                </AutoCompleteItem>
                                            ))}
                                        </AutoCompleteList>
                                    </AutoComplete>
                                </FormControl>
                            </DarkMode>
                        </Box>
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
                            <Alert
                                status="info"
                                color="black"
                                width="fit-content"
                            >
                                <AlertIcon />
                                If you want to make more changes please go to
                                Details page
                            </Alert>
                            <Box display="flex">
                                <ButtonGroup>
                                    <Button
                                        colorScheme="green"
                                        onClick={handleSubmit}
                                    >
                                        Save
                                    </Button>
                                    <Button
                                        colorScheme="purple"
                                        onClick={() =>
                                            navigate(`/results/${result.id}`)
                                        }
                                    >
                                        Details
                                    </Button>
                                    <Button
                                        colorScheme="red"
                                        onClick={handleSkip}
                                    >
                                        Skip
                                    </Button>
                                </ButtonGroup>
                            </Box>
                        </>
                    )}
                </>
            )}
        </Box>
    );
};

export default DoubleCheck;
