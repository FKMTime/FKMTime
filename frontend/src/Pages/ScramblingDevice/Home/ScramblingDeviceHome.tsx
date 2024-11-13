import { Box } from "@chakra-ui/react";
import { useAtomValue } from "jotai";
import { useCallback, useState } from "react";

import EventAndRoundSelector from "@/Components/EventAndRoundSelector";
import LoadingPage from "@/Components/LoadingPage";
import { competitionAtom } from "@/logic/atoms";
import { ScrambleSet } from "@/logic/interfaces";
import { getScrambleSetsForScramblingDevice } from "@/logic/scrambling";

import ScrambleSetsList from "./Components/ScrambleSetsList";

const ScramblingDeviceHome = () => {
    const competition = useAtomValue(competitionAtom);
    const [roundId, setRoundId] = useState<string>("");
    const [scrambleSets, setScrambleSets] = useState<ScrambleSet[]>([]);

    const handleEventChange = async (eventId: string) => {
        const id = eventId + "-r1";
        setRoundId(id);
        fetchData(id);
    };

    const handleRoundChange = (newId: string) => {
        setRoundId(newId);
        fetchData(newId);
    };

    const fetchData = useCallback(
        async (id?: string) => {
            const data = await getScrambleSetsForScramblingDevice(
                id || roundId
            );
            setScrambleSets(data);
        },
        [roundId]
    );

    if (!competition) return <LoadingPage />;

    return (
        <Box display="flex" flexDirection="column" gap={3}>
            <Box
                display="flex"
                gap={3}
                flexDirection={{ base: "column", md: "row" }}
            >
                <EventAndRoundSelector
                    competition={competition}
                    filters={{
                        eventId: roundId.split("-")[0],
                        roundId: roundId,
                    }}
                    handleEventChange={handleEventChange}
                    handleRoundChange={handleRoundChange}
                />
            </Box>
            <ScrambleSetsList scrambleSets={scrambleSets} />
        </Box>
    );
};

export default ScramblingDeviceHome;
