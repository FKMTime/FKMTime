import { useAtomValue } from "jotai";
import { useCallback, useState } from "react";

import EventAndRoundSelector from "@/Components/EventAndRoundSelector";
import LoadingPage from "@/Components/LoadingPage";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { activityCodeToName } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";
import { ScrambleSet } from "@/lib/interfaces";
import { getScrambleSetsForScramblingDevice } from "@/lib/scrambling";

import ScrambleSetsTable from "./Components/ScrambleSetsTable";

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
        <div className="flex flex-col gap-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        Scrambling device
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <EventAndRoundSelector
                        competition={competition}
                        filters={{
                            eventId: roundId.split("-")[0],
                            roundId: roundId,
                        }}
                        handleEventChange={handleEventChange}
                        handleRoundChange={handleRoundChange}
                    />
                </CardContent>
            </Card>
            {roundId ? (
                <Card>
                    <CardHeader>
                        <CardTitle>{activityCodeToName(roundId)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ScrambleSetsTable scrambleSets={scrambleSets} />
                    </CardContent>
                </Card>
            ) : null}
        </div>
    );
};

export default ScramblingDeviceHome;
