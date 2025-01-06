import { Box, Button, useToast } from "@chakra-ui/react";
import { useConfirm } from "chakra-ui-confirm";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import EventAndRoundSelector from "@/Components/EventAndRoundSelector";
import LoadingPage from "@/Components/LoadingPage";
import { competitionAtom } from "@/lib/atoms";
import { ScrambleSet } from "@/lib/interfaces";
import {
    deleteAllScrambleSets,
    deleteScrambleSetsByRoundId,
    getScrambleSets,
} from "@/lib/scrambleSets";
import { letterToNumber } from "@/logic/utils";

import AddScrambleSetModal from "./Components/AddScrambleSetModal";
import ScrambleSetsTable from "./Components/ScrambleSetsTable";

const ScrambleSets = () => {
    const confirm = useConfirm();
    const toast = useToast();
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
                        status: "info",
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
                    status: "info",
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
        <Box display="flex" flexDirection="column" gap="5">
            <Box
                display="flex"
                gap="5"
                flexDirection={{ base: "column", lg: "row" }}
            >
                <EventAndRoundSelector
                    competition={competition}
                    filters={filters}
                    handleEventChange={handleEventChange}
                    handleRoundChange={handleRoundChange}
                />
            </Box>
            <Box
                display="flex"
                gap="5"
                flexDirection={{ base: "column", md: "row" }}
            >
                {filters.roundId && (
                    <>
                        <Button
                            colorScheme="green"
                            width={{ base: "100%", md: "fit-content" }}
                            onClick={() => setIsOpenAddScrambleSetModal(true)}
                        >
                            Add scramble set
                        </Button>
                        <Button
                            colorScheme="purple"
                            width={{ base: "100%", md: "fit-content" }}
                            onClick={handleDeleteScrambleSetsByRound}
                        >
                            Delete scramble sets for this round
                        </Button>
                    </>
                )}
                <Button
                    colorScheme="red"
                    width={{ base: "100%", md: "fit-content" }}
                    onClick={handleDeleteAllScrambleSets}
                >
                    Delete all scramble sets
                </Button>
            </Box>
            <ScrambleSetsTable
                scrambleSets={scrambleSets}
                fetchData={fetchData}
            />
            <AddScrambleSetModal
                isOpen={isOpenAddScrambleSetModal}
                onClose={handleCloseAddScrambleSetModal}
                lastSet={lastSetNumber}
                roundId={filters.roundId}
            />
        </Box>
    );
};

export default ScrambleSets;
