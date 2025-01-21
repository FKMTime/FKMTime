import { useAtomValue } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/Components/ui/card";
import { activityCodeToName } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";
import { Incident } from "@/lib/interfaces";
import { getResultsChecks } from "@/lib/results";
import PageTransition from "@/Pages/PageTransition";

import EventAndRoundSelector from "../../../../Components/EventAndRoundSelector";
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
        <PageTransition>
            <div className="flex flex-col gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Suspicious times/penalties</CardTitle>
                        <CardDescription>
                            Choose event and round
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <EventAndRoundSelector
                            competition={competition}
                            filters={filters}
                            handleEventChange={handleEventChange}
                            handleRoundChange={handleRoundChange}
                        />
                    </CardContent>
                </Card>
                {filters.roundId ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>
                                {activityCodeToName(filters.roundId)}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResultsChecksTable checks={checks} />
                        </CardContent>
                    </Card>
                ) : null}
            </div>
        </PageTransition>
    );
};

export default ResultsChecks;
