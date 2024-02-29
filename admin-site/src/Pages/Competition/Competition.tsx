import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertIcon, Box, Button, Checkbox, FormControl, FormLabel, Heading, IconButton, Input, Select, Text, useToast } from "@chakra-ui/react";
import {
    getCompetitionSettings,
    importCompetition,
    syncCompetition,
    updateCompetition,
} from "../../logic/competition";
import { Competition as CompetitionInterface } from "../../logic/interfaces";
import events from "../../logic/events";
import { Activity, Event, Round } from "@wca/helpers";
import LoadingPage from "../../Components/LoadingPage";
import { IoMdEye, IoMdEyeOff } from "react-icons/io";

const Competition = (): JSX.Element => {
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [competitionImported, setCompetitionImported] = useState<boolean>(false);
    const [competition, setCompetition] = useState<CompetitionInterface | null>(null);
    const [currentEvent, setCurrentEvent] = useState<string>("");
    const [currentRound, setCurrentRound] = useState<string>("");
    const [showScoretakingToken, setShowScoretakingToken] = useState<boolean>(false);
    const idRef: React.RefObject<HTMLInputElement> = useRef<HTMLInputElement>(null);
    const toast = useToast();
    const groups = useMemo(() => {
        if (!competition || !currentRound || !competition.wcif.schedule.venues[0].rooms[0].activities) {
            return [];
        }
        //eslint-disable-next-line
        //@ts-ignore
        return competition.wcif.schedule.venues[0].rooms[0].activities.find((activity: Activity) => activity.activityCode === currentRound).childActivities;
    }, [competition, currentRound]);

    const fetchData = async () => {
        const response = await getCompetitionSettings();
        if (response.status === 200) {
            setCompetitionImported(true);
            setCompetition(response.data);
            if (response.data.currentGroupId) {
                const sliced = response.data.currentGroupId.split("-");
                setCurrentEvent(sliced[0]);
                setCurrentRound(sliced[0] + "-" + sliced[1]);
            }
        }
        else if (response.status === 404) {
            setCompetitionImported(false);
        }
        setIsLoading(false);
    };

    const handleImportCompetition = async () => {
        if (!idRef || !idRef.current || !idRef.current.value || idRef.current.value === "") {
            toast({
                title: "Error",
                description: "Please enter a competition ID",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        }
        const id = idRef.current?.value;
        if (!id) {
            return;
        }
        const response = await importCompetition(id);
        if (response.status === 200) {
            setCompetitionImported(true);
            setCompetition(response.data);
        }
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!competition) {
            return;
        }
        const status = await updateCompetition(competition.id, competition);
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

    useEffect(() => {
        fetchData();
    }, []);

    if (isLoading || (!competition && competitionImported)) {
        return <LoadingPage />;
    }

    if (!competitionImported) {
        return (
            <Box display="flex" flexDirection="column" gap="5">
                <Heading size="lg">Competition</Heading>
                <Box display="flex" flexDirection="column" gap="5" width="20%">
                    <Input placeholder="Competition ID" ref={idRef} />
                    <Button onClick={handleImportCompetition}>Import</Button>
                </Box>
            </Box>
        )
    }

    if (!competition) {
        return <LoadingPage />;
    }

    return (
        <Box display="flex" flexDirection="column" gap="5">
            <Heading size="lg">{competition?.name}</Heading>
            <Box display="flex" flexDirection="column" gap="5">
                <Alert status='warning' borderRadius="md" color="black" width="20%">
                    <AlertIcon />
                    Remember to open round in WCA Live
                </Alert>
                {competition.scoretakingToken === "" || !competition.scoretakingToken && (
                    <Alert status='error' borderRadius="md" color="black" width="40%">
                        <AlertIcon />
                        You need to set the scoretaking token taken from WCA Live before the competition
                    </Alert>
                )}
            </Box>
            <Box display="flex" flexDirection="column" gap="5" width="20%">
                <Button colorScheme="yellow" onClick={handleSync}>Sync</Button>
            </Box>
            <Box display="flex" flexDirection="column" gap="5" width="20%" as="form" onSubmit={handleSubmit}>
                <FormControl display="flex" flexDirection="column" gap="2">
                    <FormLabel display="flex" flexDirection="row" alignItems="center" gap="2">
                        <IconButton aria-label="Show" icon={showScoretakingToken ? <IoMdEyeOff /> : <IoMdEye />} onClick={() => setShowScoretakingToken(!showScoretakingToken)} background="none" color="white" _hover={{ background: "none", opacity: 0.5 }} />
                        <Text>Scoretaking token</Text>
                    </FormLabel>
                    <Input type={showScoretakingToken ? "text" : "password"} placeholder="Scoretaking token" _placeholder={{ color: "white" }} value={competition?.scoretakingToken} onChange={(event) => setCompetition({ ...competition, scoretakingToken: event?.target.value })} />
                </FormControl>
                <FormControl>
                    <FormLabel>Current event</FormLabel>
                    <Select placeholder="Select event" _placeholder={{ color: "white" }} value={currentEvent} onChange={(event) => {
                        setCurrentEvent(event?.target.value);
                        setCurrentRound(event?.target.value + "-r1");
                    }}>
                        {competition.wcif.events.map((event: Event) => (
                            <option key={event.id} value={event.id}>{events.find((e) => e.id === event.id)?.name}</option>
                        ))}
                    </Select>
                </FormControl>
                {currentEvent && (
                    <FormControl>
                        <FormLabel>Current round</FormLabel>
                        <Select placeholder="Select round" _placeholder={{ color: "white" }} value={currentRound} onChange={(event) => setCurrentRound(event?.target.value)}>
                            {competition.wcif.events.find((event: Event) => event.id === currentEvent)?.rounds.map((round: Round, i: number) => (
                                <option key={round.id} value={round.id}>{i + 1}</option>
                            ))}
                        </Select>
                    </FormControl>
                )}
                {currentRound && (
                    <FormControl>
                        <FormLabel>Current group</FormLabel>
                        <Select placeholder="Select group" _placeholder={{ color: "white" }} value={competition.currentGroupId} onChange={(event) => setCompetition({ ...competition, currentGroupId: event?.target.value })}>
                            {groups.map((group: Activity, i: number) => (
                                <option key={group.activityCode} value={group.activityCode}>{i + 1}</option>
                            ))}
                        </Select>
                    </FormControl>
                )}
                <FormControl display="flex" flexDirection="column" gap="2">
                    <Checkbox defaultChecked={competition.usesWcaProduction} onChange={(event) => setCompetition({ ...competition, usesWcaProduction: event?.target.checked })}>Uses WCA Live production</Checkbox>
                </FormControl>
                <FormControl display="flex" flexDirection="column" gap="2">
                    <Checkbox defaultChecked={competition.shouldCheckGroup} onChange={(event) => setCompetition({ ...competition, shouldCheckGroup: event?.target.checked })}>Check whether the competitor is in current group when entering attempt</Checkbox>
                </FormControl>
                <Button type="submit" colorScheme="green">Save</Button>
            </Box>
        </Box>
    )
};

export default Competition;
