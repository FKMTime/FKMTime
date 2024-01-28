import { useCallback, useEffect, useMemo, useState } from "react";
import { Competition, Result } from "../../logic/interfaces";
import { Box, Button, IconButton, Input, Select, Text, useToast } from "@chakra-ui/react";
import { getResultsByRoundId, reSubmitRoundToWcaLive } from "../../logic/results";
import { getCompetitionInfo } from "../../logic/competition";
import { useNavigate } from "react-router-dom";
import LoadingPage from "../../Components/LoadingPage";
import EventIcon from "../../Components/Icons/EventIcon";
import { Event, Round } from "@wca/helpers";
import ResultsTable from "../../Components/Table/ResultsTable";
import { resultToString } from "../../logic/resultFormatters";
import { getCutoffByRoundId, getLimitByRoundId, getNumberOfAttemptsForRound } from "../../logic/utils";
import Alert from "../../Components/Alert";

interface ResultsFilters {
    eventId: string;
    roundId: string;
}
const Results = (): JSX.Element => {
    const toast = useToast();
    const [openConfirmation, setOpenConfirmation] = useState<boolean>(false);
    const [competition, setCompetition] = useState<Competition | null>(null);
    const [results, setResults] = useState<Result[]>([]);
    const [filters, setFilters] = useState<ResultsFilters>({
        eventId: "",
        roundId: "",
    });
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

    const navigate = useNavigate();

    const fetchData = async (roundId: string, search?: string, groupId?: string) => {
        const data = await getResultsByRoundId(roundId, search, groupId);
        setResults(data);
        setFilters(prevFilters => ({ ...prevFilters, roundId: roundId, groupId: `${roundId}-g1` }));
    };

    const fetchCompetition = useCallback(async () => {
        const response = await getCompetitionInfo();
        if (response.status !== 200) {
            navigate("/competition");
        }
        setCompetition(response.data);
        const currentEventId = response.data.currentGroupId.split("-")[0] || response.data.wcif.events[0].id;
        const roundId = currentEventId + "-r1";
        setFilters({ roundId: roundId, eventId: currentEventId || response.data.wcif.events[0].id });
    }, [navigate]);

    const handleEventChange = async (id: string) => {
        const roundId = id + "-r1";
        setFilters(prevFilters => ({ ...prevFilters, roundId: roundId, eventId: id, groupId: `${roundId}-g1` }));
        await fetchData(roundId);
    };

    const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
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
        if (status === 204) {
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

    useEffect(() => {
        fetchCompetition();
    }, [fetchCompetition]);

    useEffect(() => {
        const fetchDefaultResults = async () => {
            if (competition && filters.roundId) {
                await fetchData(filters.roundId);
            }
        };

        fetchDefaultResults();
    }, [competition, filters.roundId]);

    if (!competition || !results) {
        return <LoadingPage />;
    }

    return (
        <Box display="flex" flexDirection="column" gap="5">
            <Box display="flex" flexDirection="row" gap="5">
                {competition.wcif.events.map((event: Event) => (
                    <IconButton key={event.id} aria-label={event.id} icon={<EventIcon eventId={event.id} selected={filters.eventId === event.id} size={20} />} onClick={() => handleEventChange(event.id)} justifyContent="center" alignItems="center" />
                ))}
                <Select placeholder="Select round" _placeholder={{ color: "white" }} value={filters.roundId} onChange={(event) => setFilters({ ...filters, roundId: event.target.value })} width="5%">
                    {competition.wcif.events.find((event: Event) => event.id === filters.eventId)?.rounds.map((round: Round, i: number) => (
                        <option key={round.id} value={round.id}>{i + 1}</option>
                    ))}
                </Select>
                <Input placeholder="Search" _placeholder={{ color: "white" }} width="20%" value={search} onChange={handleSearch} />
            </Box>
            <Box display="flex" flexDirection="column" gap="5">
                <Text>Cutoff: {cutoff ? `${resultToString(cutoff.attemptResult)} (${cutoff.numberOfAttempts} attempts)` : "None"}</Text>
                <Text>Limit: {limit ? `${resultToString(limit.centiseconds)} ${limit.cumulativeRoundIds.length > 0 ? "(cumulative)" : ""}` : "None"}</Text>
                <Text>Attempts: {maxAttempts}</Text>
                <Button colorScheme="yellow" w="20%" onClick={handleResubmitRound}>
                    Resubmit round results to WCA Live
                </Button>
            </Box>
            <ResultsTable results={results} />
            <Alert isOpen={openConfirmation} onCancel={handleCancel} onConfirm={handleConfirm} title="Resubmit results" description="Are you sure you want to override results from WCA Live?" />
        </Box>
    )
};

export default Results;
