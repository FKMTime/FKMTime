import { useAtomValue } from "jotai";
import { BookText } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import EventAndRoundSelector from "@/Components/EventAndRoundSelector";
import LoadingPage from "@/Components/LoadingPage";
import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";
import { ScrambleSet } from "@/lib/interfaces";
import {
    deleteAllScrambleSets,
    deleteScrambleSetsByRoundId,
    getScrambleSets,
} from "@/lib/scrambleSets";
import { letterToNumber } from "@/lib/utils";
import PageTransition from "@/Pages/PageTransition";

import AddScrambleSetModal from "./Components/AddScrambleSetModal";
import ScrambleSetsTable from "./Components/ScrambleSetsTable";

const ScrambleSets = () => {
    const confirm = useConfirm();
    const { toast } = useToast();
    const competition = useAtomValue(competitionAtom);
    const [searchParams, setSearchParams] = useSearchParams();
    const [scrambleSets, setScrambleSets] = useState<ScrambleSet[]>([]);
    const [isOpenAddScrambleSetModal, setIsOpenAddScrambleSetModal] =
        useState<boolean>(false);
    const [lastSetNumber, setLastSetNumber] = useState<number>(0);

    const filters = {
        eventId: searchParams.get("roundId")?.split("-")[0] || "",
        roundId: searchParams.get("roundId") || "",
    };

    const handleEventChange = async (eventId: string) => {
        const roundId = eventId + "-r1";
        setSearchParams({
            tab: "scrambleSets",
            roundId: roundId,
        });
        fetchData(roundId);
    };

    const handleRoundChange = (roundId: string) => {
        setSearchParams({
            tab: "scrambleSets",
            roundId: roundId,
        });
        fetchData(roundId);
    };

    const fetchData = useCallback(
        async (roundId?: string) => {
            const data = await getScrambleSets(roundId || filters.roundId);
            setScrambleSets(data);
            const lastLetter = data.reduce((acc: string, set: ScrambleSet) => {
                const letter = set.set;
                return acc < letter ? letter : acc;
            }, "A");
            setLastSetNumber(letterToNumber(lastLetter));
        },
        [filters.roundId]
    );

    const handleCloseAddScrambleSetModal = () => {
        setIsOpenAddScrambleSetModal(false);
        fetchData();
    };

    const handleDeleteScrambleSetsByRound = async () => {
        if (filters.roundId) {
            confirm({
                title: "Delete scramble sets",
                description: `Are you sure you want to delete all scramble sets for this round?`,
            })
                .then(async () => {
                    const status = await deleteScrambleSetsByRoundId(
                        filters.roundId
                    );
                    if (status === 204) {
                        toast({
                            title: "Scramble sets deleted",
                            variant: "success",
                        });
                        fetchData();
                    } else {
                        toast({
                            title: "Something went wrong",
                            variant: "destructive",
                        });
                    }
                })
                .catch(() => {
                    toast({
                        title: "Scramble sets not deleted",
                    });
                });
            fetchData();
        }
    };

    const handleDeleteAllScrambleSets = async () => {
        confirm({
            title: "Delete all scramble sets",
            description: `Are you sure you want to delete all scramble sets?`,
        })
            .then(async () => {
                const status = await deleteAllScrambleSets();
                if (status === 204) {
                    toast({
                        title: "Scramble sets deleted",
                        variant: "success",
                    });
                    fetchData();
                } else {
                    toast({
                        title: "Something went wrong",
                        variant: "destructive",
                    });
                }
            })
            .catch(() => {
                toast({
                    title: "Scramble sets not deleted",
                });
            });
    };

    useEffect(() => {
        if (filters.roundId) {
            fetchData(filters.roundId);
        }
    }, [fetchData, filters.roundId]);

    if (!competition) return <LoadingPage />;

    return (
        <PageTransition>
            <div className="flex flex-col gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BookText size={20} />
                            Scramble sets
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-5">
                        <EventAndRoundSelector
                            competition={competition}
                            filters={filters}
                            handleEventChange={handleEventChange}
                            handleRoundChange={handleRoundChange}
                        />
                        <div className="flex gap-3">
                            {filters.roundId && (
                                <>
                                    <Button
                                        variant="success"
                                        onClick={() =>
                                            setIsOpenAddScrambleSetModal(true)
                                        }
                                    >
                                        Add scramble set
                                    </Button>
                                    <Button
                                        onClick={
                                            handleDeleteScrambleSetsByRound
                                        }
                                    >
                                        Delete scramble sets for this round
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={handleDeleteAllScrambleSets}
                                    >
                                        Delete all scramble sets
                                    </Button>
                                </>
                            )}
                        </div>
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
                            {scrambleSets.length === 0 ? (
                                <p>No scramble sets found</p>
                            ) : (
                                <ScrambleSetsTable
                                    scrambleSets={scrambleSets}
                                    fetchData={fetchData}
                                />
                            )}
                        </CardContent>
                    </Card>
                ) : null}
                <AddScrambleSetModal
                    isOpen={isOpenAddScrambleSetModal}
                    onClose={handleCloseAddScrambleSetModal}
                    lastSet={lastSetNumber}
                    roundId={filters.roundId}
                />
            </div>
        </PageTransition>
    );
};

export default ScrambleSets;
