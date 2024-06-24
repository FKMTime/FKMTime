import {
    Alert,
    AlertIcon,
    Box,
    Button,
    Heading,
    Text,
    useToast,
} from "@chakra-ui/react";
import { useAtom } from "jotai";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import FlagIcon from "@/Components/Icons/FlagIcon";
import LoadingPage from "@/Components/LoadingPage";
import PlusButton from "@/Components/PlusButton";
import { activityCodeToName } from "@/logic/activities";
import { competitionAtom } from "@/logic/atoms";
import { getCompetitionInfo } from "@/logic/competition";
import { isUnofficialEvent } from "@/logic/events";
import { Result } from "@/logic/interfaces";
import { resultToString } from "@/logic/resultFormatters";
import { getResultById, reSubmitScorecardToWcaLive } from "@/logic/results";
import {
    cumulativeRoundsToString,
    getCutoffByRoundId,
    getLimitByRoundId,
    getNumberOfAttemptsForRound,
    getSubmittedAttempts,
    isThereADifferenceBetweenResults,
    regionNameByIso2,
} from "@/logic/utils";

import CreateAttemptModal from "../Components/CreateAttemptModal";
import AttemptsTable from "./Components/AttemptsTable";
import SwapAttemptsModal from "./Components/SwapAttemptsModal";

const SingleResult = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const toast = useToast();
    const [competition, setCompetition] = useAtom(competitionAtom);
    const [result, setResult] = useState<Result | null>(null);
    const [isOpenCreateAttemptModal, setIsOpenCreateAttemptModal] =
        useState<boolean>(false);
    const [isOpenSwapAttemptsModal, setIsOpenSwapAttemptsModal] =
        useState<boolean>(false);
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

    const isDifferenceBetweenResults = useMemo(() => {
        if (!result || !competition) return false;
        return isThereADifferenceBetweenResults(
            result,
            submittedAttempts,
            competition.wcif
        );
    }, [competition, result, submittedAttempts]);

    const cutoff = useMemo(() => {
        if (!competition || !result) {
            return null;
        }
        return getCutoffByRoundId(result.roundId, competition.wcif);
    }, [competition, result]);
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
                status: "error",
                duration: 5000,
                isClosable: true,
            });
            navigate("/results");
        }
        setResult(response.data);
    }, [competition, id, navigate, setCompetition, toast]);

    const handleResubmit = async () => {
        if (!result) return;
        const status = await reSubmitScorecardToWcaLive(result.id);
        if (status === 200) {
            toast({
                title: "Success",
                description: "Scorecard resubmitted to WCA Live",
                status: "success",
                duration: 5000,
                isClosable: true,
            });
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        }
    };

    const handleCloseModal = () => {
        fetchData();
        setIsOpenCreateAttemptModal(false);
        setIsOpenSwapAttemptsModal(false);
    };

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (!result) return <LoadingPage />;

    return (
        <Box display="flex" flexDirection="column" gap={3}>
            <Heading>Competitor</Heading>
            <Text fontSize="xl">Name: {result.person.name}</Text>
            <Text fontSize="xl">
                Registrant ID: {result.person.registrantId}
            </Text>
            <Text fontSize="xl">WCA ID: {result.person.wcaId}</Text>
            {result.person.countryIso2 && (
                <Text fontSize="xl">
                    <Box display="flex" alignItems="center" gap="1">
                        <Text>
                            Representing:{" "}
                            {regionNameByIso2(result.person.countryIso2)}
                        </Text>
                        <FlagIcon
                            country={result.person.countryIso2}
                            size={20}
                        />
                    </Box>
                </Text>
            )}
            {!isUnofficialEvent(result.eventId) && (
                <>
                    <Button
                        colorScheme="yellow"
                        width={{ base: "100%", md: "fit-content" }}
                        onClick={handleResubmit}
                    >
                        Resubmit scorecard to WCA Live
                    </Button>
                    {isDifferenceBetweenResults && (
                        <Alert status="error" color="black">
                            <AlertIcon />
                            There is a difference between results in WCA Live
                            and FKM. Please check it manually, fix in FKM and
                            resubmit scorecard to WCA Live.
                        </Alert>
                    )}
                </>
            )}
            <Heading mt={3}>
                Limits for {activityCodeToName(result.roundId)}
            </Heading>
            <Text fontSize="xl">
                Cutoff:{" "}
                {cutoff
                    ? `${resultToString(cutoff.attemptResult)} (${cutoff.numberOfAttempts} attempts)`
                    : "None"}
            </Text>
            <Text
                fontSize="xl"
                title={`For ${cumulativeRoundsToString(limit?.cumulativeRoundIds || [])}`}
            >
                Limit:{" "}
                {limit
                    ? `${resultToString(limit.centiseconds)} ${limit.cumulativeRoundIds.length > 0 ? "(cumulative)" : ""}`
                    : "None"}
            </Text>
            <Text fontSize="xl">Attempts: {maxAttempts}</Text>
            <Box display="flex" gap="5" alignItems="center">
                <Heading mt={3}>Attempts</Heading>
                <PlusButton
                    aria-label="Add"
                    onClick={() => setIsOpenCreateAttemptModal(true)}
                />
            </Box>
            <Heading size="md">List of attempts submitted to WCA Live</Heading>
            {submittedAttempts.length === 0 ? (
                <Text>No attempts submitted to WCA Live</Text>
            ) : (
                <AttemptsTable
                    attempts={submittedAttempts as never}
                    fetchData={fetchData}
                    result={result}
                />
            )}
            <Heading size="md">Standard</Heading>
            <Button
                colorScheme="yellow"
                onClick={() => setIsOpenSwapAttemptsModal(true)}
                width={{ base: "100%", md: "20%" }}
            >
                Swap attempts
            </Button>
            {standardAttempts.length === 0 ? (
                <Text>No attempts</Text>
            ) : (
                <AttemptsTable
                    attempts={standardAttempts}
                    showExtraColumns
                    fetchData={fetchData}
                    result={result}
                />
            )}
            <Heading size="md">Extra</Heading>
            {extraAttempts.length === 0 ? (
                <Text>No extra attempts</Text>
            ) : (
                <AttemptsTable
                    attempts={extraAttempts}
                    fetchData={fetchData}
                    result={result}
                    showExtraColumns
                />
            )}
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
        </Box>
    );
};

export default SingleResult;
