import { Box, Button, Heading, Input, Text, useToast } from "@chakra-ui/react";
import { useConfirm } from "chakra-ui-confirm";
import { useAtom } from "jotai";
import {
    ChangeEvent,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import { activityCodeToName } from "@/logic/activities";
import { competitionAtom } from "@/logic/atoms";
import { isAdmin } from "@/logic/auth";
import { getCompetitionInfo } from "@/logic/competition";
import { Result, Room } from "@/logic/interfaces";
import { resultToString } from "@/logic/resultFormatters";
import { getResultsByRoundId, reSubmitRoundToWcaLive } from "@/logic/results";
import { getAllRooms } from "@/logic/rooms";
import {
    cumulativeRoundsToString,
    getCutoffByRoundId,
    getLimitByRoundId,
    getNumberOfAttemptsForRound,
    getSubmissionPlatformName,
} from "@/logic/utils";
import { socket, SocketContext } from "@/socket";

import CreateAttemptModal from "./Components/CreateAttemptModal";
import EventAndRoundSelector from "./Components/EventAndRoundSelector";
import ResultsTable from "./Components/ResultsTable";
import RestartGroupModal from "./SingleResult/Components/RestartGroupModal";

const Results = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const confirm = useConfirm();

    const filters = {
        eventId: id?.split("-")[0] || "",
        roundId: id || "",
    };
    const toast = useToast();

    const [competition, setCompetition] = useAtom(competitionAtom);
    const [results, setResults] = useState<Result[]>([]);
    const [currentRounds, setCurrentRounds] = useState<string[]>([]);

    const [isOpenCreateAttemptModal, setIsOpenCreateAttemptModal] =
        useState<boolean>(false);
    const [isOpenRestartGroupModal, setIsOpenRestartGroupModal] =
        useState<boolean>(false);

    const [search, setSearch] = useState<string>("");
    const cutoff = useMemo(() => {
        if (!competition) {
            return null;
        }
        return getCutoffByRoundId(filters.roundId, competition.wcif);
    }, [competition, filters.roundId]);
    const limit = useMemo(() => {
        if (!competition) {
            return null;
        }
        return getLimitByRoundId(filters.roundId, competition.wcif);
    }, [competition, filters.roundId]);

    const maxAttempts = useMemo(() => {
        if (!competition) {
            return 0;
        }
        return getNumberOfAttemptsForRound(filters.roundId, competition.wcif);
    }, [competition, filters.roundId]);

    const submissionPlatformName = getSubmissionPlatformName(filters.eventId);

    const fetchData = useCallback(
        async (roundId: string, searchParam?: string) => {
            const data = await getResultsByRoundId(roundId, searchParam);
            if (roundId === filters.roundId && roundId !== "") {
                setResults(data);
            }
        },
        [filters.roundId]
    );

    const fetchCompetition = useCallback(async () => {
        const response = await getCompetitionInfo();
        if (response.status !== 200) {
            navigate("/competition");
        }
        setCompetition(response.data);
    }, [navigate, setCompetition]);

    const handleEventChange = async (eventId: string) => {
        const roundId = eventId + "-r1";
        navigate(`/results/round/${roundId}`);
        await fetchData(roundId);
    };

    const handleRoundChange = (roundId: string) => {
        navigate(`/results/round/${roundId}`);
    };

    const handleSearch = (event: ChangeEvent<HTMLInputElement>) => {
        fetchData(filters.roundId, event.target.value);
        setSearch(event.target.value);
    };

    const handleResubmitRound = async () => {
        confirm({
            title: "Resubmit results",
            description: `Are you sure you want to override results from ${submissionPlatformName}?`,
        })
            .then(async () => {
                const status = await reSubmitRoundToWcaLive(filters.roundId);
                if (status === 200) {
                    toast({
                        title: `Successfully resubmitted round results to ${submissionPlatformName}`,
                        status: "success",
                    });
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
                    description:
                        "You have cancelled the resubmission of the results.",
                    status: "info",
                });
            });
    };

    const handleCloseCreateAttemptModal = () => {
        fetchData(filters.roundId);
        setIsOpenCreateAttemptModal(false);
    };

    const handleCloseRestartGroupModal = () => {
        fetchData(filters.roundId);
        setIsOpenRestartGroupModal(false);
    };

    useEffect(() => {
        if (!competition) {
            fetchCompetition();
        }
    }, [competition, fetchCompetition]);

    const [isConnected] = useContext(SocketContext) as [
        number,
        React.Dispatch<React.SetStateAction<number>>,
    ];
    useEffect(() => {
        if (filters.roundId) {
            if (!isAdmin()) {
                navigate(`/results/public/${filters.roundId}`);
            }
            fetchData(filters.roundId);
        } else {
            if (currentRounds.length === 1) {
                navigate(`/results/round/${currentRounds[0]}`);
            }
        }

        socket.emit("joinResults", { roundId: filters.roundId });
        socket.on("resultEntered", () => {
            fetchData(filters.roundId);
        });

        return () => {
            socket.emit("leaveResults", { roundId: filters.roundId });
        };
    }, [currentRounds, fetchData, filters.roundId, navigate, isConnected]);

    useEffect(() => {
        getAllRooms().then((rooms: Room[]) => {
            const ids = new Set<string>(
                rooms
                    .filter((room) => room.currentGroupId)
                    .map((room) => room.currentGroupId.split("-g")[0])
            );
            setCurrentRounds([...ids]);
        });
    }, []);

    if (!competition || !results) {
        return <LoadingPage />;
    }

    return (
        <Box display="flex" flexDirection="column" gap="5">
            <Box
                display="flex"
                flexDirection={{ base: "column", md: "row" }}
                gap="5"
            >
                <EventAndRoundSelector
                    competition={competition}
                    filters={filters}
                    handleEventChange={handleEventChange}
                    handleRoundChange={handleRoundChange}
                />
                <Input
                    placeholder="Search"
                    _placeholder={{ color: "white" }}
                    width={{ base: "100%", md: "20%" }}
                    value={search}
                    onChange={handleSearch}
                />
                {currentRounds.map((roundId) => (
                    <Button
                        key={roundId}
                        colorScheme="blue"
                        onClick={() => {
                            navigate(`/results/round/${roundId}`);
                        }}
                    >
                        {activityCodeToName(roundId)}
                    </Button>
                ))}
            </Box>
            {filters.roundId && (
                <Box display="flex" flexDirection="column" gap="5">
                    <Text>
                        Cutoff:{" "}
                        {cutoff
                            ? `${resultToString(cutoff.attemptResult)} (${cutoff.numberOfAttempts} attempts)`
                            : "None"}
                    </Text>
                    <Text
                        title={`For ${cumulativeRoundsToString(limit?.cumulativeRoundIds || [])}`}
                    >
                        Limit:{" "}
                        {limit
                            ? `${resultToString(limit.centiseconds)} ${limit.cumulativeRoundIds.length > 0 ? "(cumulative)" : ""}`
                            : "None"}
                    </Text>
                    <Text>Attempts: {maxAttempts}</Text>

                    <Box
                        display="flex"
                        gap="3"
                        flexDirection={{ base: "column", md: "row" }}
                    >
                        <Button
                            colorScheme="green"
                            width={{
                                base: "100%",
                                md: "fit-content",
                            }}
                            onClick={() => setIsOpenCreateAttemptModal(true)}
                        >
                            Enter attempt
                        </Button>
                        <Button
                            colorScheme="yellow"
                            width={{
                                base: "100%",
                                md: "fit-content",
                            }}
                            onClick={handleResubmitRound}
                        >
                            Resubmit results to {submissionPlatformName}
                        </Button>
                        <Button
                            colorScheme="blue"
                            width={{
                                base: "100%",
                                md: "fit-content",
                            }}
                            onClick={() =>
                                navigate(`/results/public/${filters.roundId}`)
                            }
                        >
                            Public view
                        </Button>

                        {results.length > 0 && (
                            <Button
                                colorScheme="red"
                                width={{
                                    base: "100%",
                                    md: "fit-content",
                                }}
                                onClick={() => setIsOpenRestartGroupModal(true)}
                            >
                                Restart group
                            </Button>
                        )}
                    </Box>
                </Box>
            )}
            {results && results.length > 0 ? (
                <ResultsTable
                    results={results}
                    maxAttempts={maxAttempts}
                    fetchData={fetchData}
                />
            ) : (
                <Heading size="lg">No results found</Heading>
            )}
            <CreateAttemptModal
                isOpen={isOpenCreateAttemptModal}
                onClose={handleCloseCreateAttemptModal}
                roundId={filters.roundId}
                timeLimit={limit!}
            />
            <RestartGroupModal
                isOpen={isOpenRestartGroupModal}
                onClose={handleCloseRestartGroupModal}
                roundId={filters.roundId}
                wcif={competition.wcif}
            />
        </Box>
    );
};

export default Results;
