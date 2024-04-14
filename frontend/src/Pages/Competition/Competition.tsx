import {
    Alert,
    AlertIcon,
    Box,
    Button,
    Checkbox,
    FormControl,
    FormLabel,
    Heading,
    useToast,
} from "@chakra-ui/react";
import { useSetAtom } from "jotai";
import { FormEvent, useCallback, useEffect, useState } from "react";

import LoadingPage from "@/Components/LoadingPage";
import PasswordInput from "@/Components/PasswordInput.tsx";
import { competitionAtom, showSidebarAtom } from "@/logic/atoms";
import {
    getCompetitionInfo,
    getCompetitionSettings,
    syncCompetition,
    updateCompetitionSettings,
} from "@/logic/competition";
import { Competition as CompetitionInterface } from "@/logic/interfaces";
import ImportCompetition from "@/Pages/Competition/ImportCompetition";

const Competition = () => {
    const setCompetitionAtom = useSetAtom(competitionAtom);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [competitionImported, setCompetitionImported] =
        useState<boolean>(false);
    const setShowSidebar = useSetAtom(showSidebarAtom);
    const [competition, setCompetition] = useState<CompetitionInterface | null>(
        null
    );
    const toast = useToast();

    const fetchData = useCallback(async () => {
        const response = await getCompetitionSettings();
        if (response.status === 200) {
            setCompetitionImported(true);
            setCompetition(response.data);
        } else if (response.status === 404) {
            setCompetitionImported(false);
            setShowSidebar(false);
        }
        setIsLoading(false);
    }, [setShowSidebar]);

    const handleImportCompetition = async (data: CompetitionInterface) => {
        setShowSidebar(true);
        setCompetitionImported(true);
        setCompetition(data);
        await fetchCompetitionDataAndSetAtom();
    };

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

    if (isLoading || (!competition && competitionImported)) {
        return <LoadingPage />;
    }

    if (!competitionImported) {
        return (
            <ImportCompetition
                handleImportCompetition={handleImportCompetition}
            />
        );
    }

    if (!competition) {
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
            <Box
                display="flex"
                flexDirection="column"
                gap="5"
                as="form"
                onSubmit={handleSubmit}
            >
                <FormControl display="flex" flexDirection="column" gap="2">
                    <FormLabel>Scoretaking token</FormLabel>
                    <PasswordInput
                        placeholder="Scoretaking token"
                        autoComplete="off"
                        value={competition?.scoretakingToken}
                        onChange={(event) =>
                            setCompetition({
                                ...competition,
                                scoretakingToken: event?.target.value,
                            })
                        }
                    />
                </FormControl>
                <FormControl display="flex" flexDirection="column" gap="2">
                    <Checkbox
                        defaultChecked={competition.sendResultsToWcaLive}
                        onChange={(event) =>
                            setCompetition({
                                ...competition,
                                sendResultsToWcaLive: event?.target.checked,
                            })
                        }
                    >
                        Send results to WCA Live (disable it only during
                        tutorial)
                    </Checkbox>
                </FormControl>
                <Button type="submit" colorScheme="green">
                    Save
                </Button>
            </Box>
        </Box>
    );
};

export default Competition;
