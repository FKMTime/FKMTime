import { useAtom } from "jotai";
import {
    ChangeEvent,
    Dispatch,
    SetStateAction,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    getCutoffByRoundId,
    getLimitByRoundId,
    getNumberOfAttemptsForRound,
} from "wcif-helpers";

import LoadingPage from "@/Components/LoadingPage";
import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Input } from "@/Components/ui/input";
import { activityCodeToName } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";
import { isAdmin } from "@/lib/auth";
import { getCompetitionInfo } from "@/lib/competition";
import { Result, Room } from "@/lib/interfaces";
import { getResultsByRoundId } from "@/lib/results";
import { getAllRooms } from "@/lib/rooms";
import { socket, SocketContext } from "@/socket";

import EventAndRoundSelector from "../../../Components/EventAndRoundSelector";
import CreateAttemptModal from "./Components/CreateAttemptModal";
import RestartGroupModal from "./Components/RestartGroupModal";
import ResultsActions from "./Components/ResultsActions";
import ResultsTable from "./Components/ResultsTable";
import RoundLimits from "./Components/RoundLimits";

const Results = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const filters = {
        eventId: id?.split("-")[0] || "",
        roundId: id || "",
    };

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
        Dispatch<SetStateAction<number>>,
    ];
    useEffect(() => {
        if (filters.roundId) {
            if (!isAdmin()) {
                navigate(`/results/public/${filters.roundId}`);
            }
            fetchData(filters.roundId);
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
        <div className="flex flex-col gap-4">
            <Card>
                <CardHeader>
                    <CardTitle>Results</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                    <div className="flex md:flex-row flex-col gap-5 justify-between items-start">
                        <EventAndRoundSelector
                            competition={competition}
                            filters={filters}
                            handleEventChange={handleEventChange}
                            handleRoundChange={handleRoundChange}
                        />
                        {filters.roundId && (
                            <div className="flex flex-col">
                                <RoundLimits
                                    cutoff={cutoff}
                                    limit={limit}
                                    maxAttempts={maxAttempts}
                                    size="md"
                                />
                            </div>
                        )}
                    </div>
                    {currentRounds.length > 1 && (
                        <div className="flex gap-5">
                            {currentRounds.map((roundId) => (
                                <Button
                                    key={roundId}
                                    onClick={() => {
                                        navigate(`/results/round/${roundId}`);
                                    }}
                                    className="w-fit"
                                >
                                    {activityCodeToName(roundId)}
                                </Button>
                            ))}
                        </div>
                    )}
                    {filters.roundId && (
                        <Input
                            placeholder="Search"
                            value={search}
                            onChange={handleSearch}
                        />
                    )}
                </CardContent>
            </Card>
            {filters.roundId && (
                <Card>
                    <CardHeader>
                        <CardTitle>Actions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResultsActions
                            filters={filters}
                            setIsOpenCreateAttemptModal={
                                setIsOpenCreateAttemptModal
                            }
                            setIsOpenRestartGroupModal={
                                setIsOpenRestartGroupModal
                            }
                            resultsLength={results.length}
                        />
                    </CardContent>
                </Card>
            )}
            {filters.roundId && (
                <Card>
                    <CardHeader>
                        <CardTitle>Results</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {results && results.length > 0 ? (
                            <ResultsTable
                                results={results}
                                maxAttempts={maxAttempts}
                                fetchData={fetchData}
                            />
                        ) : (
                            <h2 className="text-lg">No results found</h2>
                        )}
                    </CardContent>
                </Card>
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
        </div>
    );
};

export default Results;
