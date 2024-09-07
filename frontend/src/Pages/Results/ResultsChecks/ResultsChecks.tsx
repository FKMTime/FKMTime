import { Box, Heading } from "@chakra-ui/react";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import { competitionAtom } from "@/logic/atoms";
import { Incident } from "@/logic/interfaces";
import { getResultsChecks } from "@/logic/results";

import EventAndRoundSelector from "../Components/EventAndRoundSelector";
import ResultsChecksTable from "./Components/ResultsChecksTable";

const ResultsChecks = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const filters = {
        eventId: id?.split("-")[0] || "",
        roundId: id || "",
    };
    const [checks, setChecks] = useState<Incident[]>([]);
    const competition = useAtomValue(competitionAtom);

    const fetchData = useCallback(async (newId?: string) => {
        getResultsChecks(newId).then(setChecks);
    }, []);

    const handleEventChange = async (eventId: string) => {
        if (eventId === filters.eventId) {
            navigate(`/results/checks/`);
            await fetchData();
        } else {
            const roundId = eventId + "-r1";
            navigate(`/results/checks/${roundId}`);
            await fetchData(roundId);
        }
    };

    const handleRoundChange = (roundId: string) => {
        navigate(`/results/checks/${roundId}`);
    };

    useEffect(() => {
        fetchData(filters.roundId);
    }, [fetchData, filters.roundId]);

    if (!competition) return <LoadingPage />;

    return (
        <Box display="flex" flexDirection="column" gap="5">
            <Heading size="lg">Suspicious times/penalties</Heading>
            <Box display="flex" flexDirection="row" gap="5">
                <EventAndRoundSelector
                    competition={competition}
                    filters={filters}
                    handleEventChange={handleEventChange}
                    handleRoundChange={handleRoundChange}
                />
            </Box>
            <ResultsChecksTable checks={checks} />
        </Box>
    );
};

export default ResultsChecks;
