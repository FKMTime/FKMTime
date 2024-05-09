import {
    Box,
    Button,
    Flex,
    Heading,
    IconButton,
    Input,
    Text,
    useToast,
} from "@chakra-ui/react";
import { activityCodeToName, Event, Round } from "@wca/helpers";
import { useAtom } from "jotai";
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import io from "socket.io-client";

import Alert from "@/Components/Alert";
import EventIcon from "@/Components/Icons/EventIcon";
import LoadingPage from "@/Components/LoadingPage";
import PlusButton from "@/Components/PlusButton.tsx";
import Select from "@/Components/Select";
import { competitionAtom } from "@/logic/atoms";
import { getToken, isAdmin } from "@/logic/auth";
import { getCompetitionInfo } from "@/logic/competition";
import { Result, Room } from "@/logic/interfaces";
import { RESULTS_WEBSOCKET_URL, WEBSOCKET_PATH } from "@/logic/request";
import { resultToString } from "@/logic/resultFormatters";
import { getResultsByRoundId, reSubmitRoundToWcaLive } from "@/logic/results";
import { getAllRooms } from "@/logic/rooms";
import {
    cumulativeRoundsToString,
    getCutoffByRoundId,
    getLimitByRoundId,
    getNumberOfAttemptsForRound,
} from "@/logic/utils";

import CreateAttemptModal from "./Components/CreateAttemptModal";
import ResultsTable from "./Components/ResultsTable";

const Results = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const filters = {
        eventId: id?.split("-")[0] || "",
        roundId: id || "",
    };
    const toast = useToast();
    const [socket] = useState(
        io(RESULTS_WEBSOCKET_URL, {
            transports: ["websocket"],
            path: WEBSOCKET_PATH,
            closeOnBeforeunload: true,
            auth: {
                token: getToken(),
            },
        })
    );

    const [openConfirmation, setOpenConfirmation] = useState<boolean>(false);
    const [competition, setCompetition] = useAtom(competitionAtom);
    const [results, setResults] = useState<Result[]>([]);
    const [currentRounds, setCurrentRounds] = useState<string[]>([]);

    const [isOpenCreateAttemptModal, setIsOpenCreateAttemptModal] =
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

    const fetchData = async (roundId: string, searchParam?: string) => {
        const data = await getResultsByRoundId(roundId, searchParam);
        setResults(data);
    };

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

    const handleSearch = (event: ChangeEvent<HTMLInputElement>) => {
        fetchData(filters.roundId, event.target.value);
        setSearch(event.target.value);
    };

    const handleResubmitRound = () => {
        setOpenConfirmation(true);
    };

    const handleCancel = () => {
        setOpenConfirmation(false);
    };

    const handleConfirm = async () => {
        setOpenConfirmation(false);
        const status = await reSubmitRoundToWcaLive(filters.roundId);
        if (status === 200) {
            toast({
                title: "Successfully resubmitted round results to WCA Live.",
                status: "success",
                duration: 9000,
                isClosable: true,
            });
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                status: "error",
                duration: 9000,
                isClosable: true,
            });
        }
    };

    const handleCloseCreateAttemptModal = () => {
        fetchData(filters.roundId);
        setIsOpenCreateAttemptModal(false);
    };

    useEffect(() => {
        if (!competition) {
            fetchCompetition();
        }
    }, [competition, fetchCompetition]);

    useEffect(() => {
        if (filters.roundId) {
            fetchData(filters.roundId);
        } else {
            if (currentRounds.length === 1) {
                navigate(`/results/round/${currentRounds[0]}`);
            }
        }

        socket.emit("join", { roundId: filters.roundId });

        socket.on("resultEntered", () => {
            fetchData(filters.roundId);
        });

        return () => {
            socket.emit("leave", { roundId: filters.roundId });
        };
    }, [currentRounds, filters.roundId, navigate, socket]);

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
                <Box display="flex" flexDirection="row" gap="5">
                    {competition.wcif.events.map((event: Event) => (
                        <IconButton
                            key={event.id}
                            aria-label={event.id}
                            icon={
                                <EventIcon
                                    eventId={event.id}
                                    selected={filters.eventId === event.id}
                                    size={20}
                                />
                            }
                            onClick={() => handleEventChange(event.id)}
                            justifyContent="center"
                            alignItems="center"
                        />
                    ))}
                </Box>
                <Box width={{ base: "100%", md: "5%" }}>
                    <Select
                        value={filters.roundId}
                        onChange={(event) =>
                            navigate(`/results/round/${event.target.value}`)
                        }
                    >
                        {competition.wcif.events
                            .find(
                                (event: Event) => event.id === filters.eventId
                            )
                            ?.rounds.map((round: Round, i: number) => (
                                <option key={round.id} value={round.id}>
                                    {i + 1}
                                </option>
                            ))}
                    </Select>
                </Box>
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
                    {isAdmin() && (
                        <PlusButton
                            onClick={() => setIsOpenCreateAttemptModal(true)}
                            aria-label="Add"
                            display={{ base: "none", md: "flex" }}
                        />
                    )}
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
                    {isAdmin() && results.length > 0 && (
                        <Flex gap="2">
                            <Button
                                colorScheme="yellow"
                                width={{ base: "100%", md: "fit-content" }}
                                onClick={handleResubmitRound}
                            >
                                Resubmit round results to WCA Live
                            </Button>
                            <PlusButton
                                onClick={() =>
                                    setIsOpenCreateAttemptModal(true)
                                }
                                aria-label="Add"
                                display={{ base: "flex", md: "none" }}
                            />
                        </Flex>
                    )}
                </Box>
            )}
            {results.length > 0 ? (
                <ResultsTable
                    results={results}
                    maxAttempts={maxAttempts}
                    fetchData={fetchData}
                />
            ) : (
                <Heading size="lg">No results found</Heading>
            )}
            <Alert
                isOpen={openConfirmation}
                onCancel={handleCancel}
                onConfirm={handleConfirm}
                title="Resubmit results"
                description="Are you sure you want to override results from WCA Live?"
            />
            <CreateAttemptModal
                isOpen={isOpenCreateAttemptModal}
                onClose={handleCloseCreateAttemptModal}
                roundId={filters.roundId}
                timeLimit={limit!}
            />
        </Box>
    );
};

export default Results;
