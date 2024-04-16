import {
    Alert,
    AlertIcon,
    Box,
    Button,
    Heading,
    Text,
    useToast,
} from "@chakra-ui/react";
import { useSetAtom } from "jotai";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import { competitionAtom } from "@/logic/atoms";
import {
    getCompetitionInfo,
    getCompetitionSettings,
    getCompetitionStatistics,
    syncCompetition,
    updateCompetitionSettings,
} from "@/logic/competition";
import {
    Competition as CompetitionInterface,
    CompetitionStatistics,
} from "@/logic/interfaces";

import CompetitionForm from "./Components/CompetitionForm";

const Competition = () => {
    const navigate = useNavigate();
    const setCompetitionAtom = useSetAtom(competitionAtom);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [competition, setCompetition] = useState<CompetitionInterface | null>(
        null
    );
    const [statistics, setStatistics] = useState<CompetitionStatistics | null>(
        null
    );
    const toast = useToast();

    const fetchData = useCallback(async () => {
        const response = await getCompetitionSettings();
        if (response.status === 200) {
            setCompetition(response.data);
        } else if (response.status === 404) {
            navigate("/competition/import");
        }
        setIsLoading(false);
    }, [navigate]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!competition) {
            return;
        }
        const status = await updateCompetitionSettings(
            competition.id,
            competition
        );
        if (status === 200) {
            toast({
                title: "Success",
                description: "Competition updated",
                status: "success",
                duration: 3000,
                isClosable: true,
            });
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        }
    };

    const handleSync = async () => {
        if (!competition || !competition.wcaId) {
            return;
        }
        const status = await syncCompetition(competition.wcaId);
        if (status === 200) {
            toast({
                title: "Success",
                description: "Competition synced",
                status: "success",
                duration: 3000,
                isClosable: true,
            });
            await fetchCompetitionDataAndSetAtom();
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        }
    };

    const fetchCompetitionDataAndSetAtom = async () => {
        const response = await getCompetitionInfo();
        setCompetitionAtom(response.data);
    };

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        getCompetitionStatistics().then((data) => {
            setStatistics(data);
        });
    }, []);

    if (isLoading || !competition) {
        return <LoadingPage />;
    }

    return (
        <Box
            display="flex"
            flexDirection="column"
            gap="5"
            width={{ base: "100%", md: "20%" }}
        >
            <Heading size="lg">{competition?.name}</Heading>
            <Box display="flex" flexDirection="column" gap="5">
                <Alert status="warning" borderRadius="md" color="black">
                    <AlertIcon />
                    Remember to open round in WCA Live
                </Alert>
                {competition.scoretakingToken === "" ||
                    (!competition.scoretakingToken && (
                        <Alert status="error" borderRadius="md" color="black">
                            <AlertIcon />
                            You need to set the scoretaking token taken from WCA
                            Live before the competition
                        </Alert>
                    ))}
                {competition.scoretakingTokenUpdatedAt &&
                    new Date(competition.scoretakingTokenUpdatedAt).getTime() <
                        new Date().getTime() - 7 * 24 * 60 * 60 * 1000 && (
                        <Alert status="error" borderRadius="md" color="black">
                            <AlertIcon />
                            The scoretaking token may have expired
                        </Alert>
                    )}
            </Box>
            <Box display="flex" flexDirection="column" gap="5">
                <Button colorScheme="yellow" onClick={handleSync}>
                    Sync
                </Button>
            </Box>
            <CompetitionForm
                competition={competition}
                setCompetition={setCompetition}
                handleSubmit={handleSubmit}
            />
            {statistics && (
                <Box display="flex" flexDirection="column" gap="5">
                    <Heading size="md">Competition statistics</Heading>
                    <Text>All attempts: {statistics?.allAttempts}</Text>
                    <Text>
                        Attempts entered manually:{" "}
                        {statistics?.attemptsEnteredManually}
                    </Text>
                </Box>
            )}
        </Box>
    );
};

export default Competition;
