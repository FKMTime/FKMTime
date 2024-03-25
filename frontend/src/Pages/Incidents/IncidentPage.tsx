import {
    Box,
    Button,
    Checkbox,
    FormControl,
    FormLabel,
    Heading,
    Input,
    Text,
    useToast,
} from "@chakra-ui/react";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Incident, Person } from "../../logic/interfaces.ts";
import { getIncidentById, updateAttempt } from "../../logic/attempt.ts";
import LoadingPage from "../../Components/LoadingPage.tsx";
import { getAllPersons } from "../../logic/persons.ts";
import { msToString } from "../../logic/utils.ts";
import AttemptResultInput from "../../Components/AttemptResultInput.tsx";
import { checkTimeLimit } from "../../logic/results.ts";
import { useAtomValue } from "jotai";
import { competitionAtom } from "../../logic/atoms.ts";
import { DNF_VALUE } from "../../logic/constants.ts";
import PenaltySelect from "../../Components/PenaltySelect.tsx";
import Select from "../../Components/Select.tsx";

const IncidentPage = () => {
    const navigate = useNavigate();
    const competition = useAtomValue(competitionAtom);
    const toast = useToast();
    const { id } = useParams<{ id: string }>();
    const [persons, setPersons] = useState<Person[]>([]);
    const [editedIncident, setEditedIncident] = useState<Incident | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    useEffect(() => {
        if (!id) return;
        getIncidentById(id).then((data) => {
            setEditedIncident(data);
        });
    }, [id]);

    useEffect(() => {
        getAllPersons().then((data) => {
            setPersons(data);
        });
    }, []);

    if (!editedIncident) {
        return <LoadingPage />;
    }

    const a7g = () => {
        const data = {
            ...editedIncident,
            isResolved: true,
            extraGiven: true,
            comment: "A7G",
            shouldResubmitToWcaLive: false,
        };
        setEditedIncident(data);
        handleSubmit(data);
    };

    const judgeFault = () => {
        const data = {
            ...editedIncident,
            isResolved: true,
            extraGiven: true,
            comment: "Judge fault",
            shouldResubmitToWcaLive: false,
        };
        setEditedIncident(data);
        handleSubmit(data);
    };

    const ok = () => {
        const data = {
            ...editedIncident,
            isResolved: true,
            extraGiven: false,
            shouldResubmitToWcaLive: true,
        };
        setEditedIncident(data);
        handleSubmit(data);
    };

    const handleSubmit = async (data: Incident) => {
        setIsLoading(true);
        const status = await updateAttempt(data);
        if (status === 200) {
            toast({
                title: "Incident updated",
                status: "success",
                duration: 3000,
                isClosable: true,
            });
            navigate("/incidents");
        } else {
            toast({
                title: "Error",
                description: "An error occurred while updating the incident",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        }
        setIsLoading(false);
    };

    return (
        <Box
            display="flex"
            flexDirection="column"
            gap="5"
            width={{ base: "100%", md: "20%" }}
        >
            <Button
                colorScheme="yellow"
                onClick={() =>
                    navigate(`/results/${editedIncident?.result.id}`)
                }
            >
                All attempts from this average
            </Button>
            <Heading size="lg">Quick actions</Heading>
            <Button colorScheme="purple" onClick={a7g}>
                A7G
            </Button>
            <Button colorScheme="blue" onClick={judgeFault}>
                Judge fault
            </Button>
            <Button colorScheme="green" onClick={ok}>
                Resolve as it is
            </Button>
            <FormControl isRequired>
                <FormLabel>Attempt number</FormLabel>
                <Input
                    placeholder="Attempt number"
                    _placeholder={{ color: "white" }}
                    value={editedIncident.attemptNumber}
                    disabled={isLoading}
                    onChange={(e) =>
                        setEditedIncident({
                            ...editedIncident,
                            attemptNumber: +e.target.value,
                        })
                    }
                />
            </FormControl>
            <FormControl isRequired>
                <FormLabel>Time</FormLabel>
                <AttemptResultInput
                    value={editedIncident.value}
                    onChange={(newValue) => {
                        if (!competition) {
                            setEditedIncident({
                                ...editedIncident,
                                value: newValue,
                            });
                            return;
                        }
                        const isLimitPassed = checkTimeLimit(
                            newValue,
                            competition?.wcif,
                            editedIncident.result.roundId
                        );
                        if (!isLimitPassed) {
                            toast({
                                title: "This attempt is over the time limit.",
                                description: "This time is DNF.",
                                status: "error",
                                duration: 9000,
                                isClosable: true,
                            });
                            setEditedIncident({
                                ...editedIncident,
                                value: newValue,
                                penalty: DNF_VALUE,
                            });
                            return;
                        }
                        setEditedIncident({
                            ...editedIncident,
                            value: newValue,
                        });
                    }}
                    disabled={isLoading}
                />
            </FormControl>
            {editedIncident.inspectionTime && (
                <Text>
                    Inspection time: {msToString(editedIncident.inspectionTime)}
                </Text>
            )}
            <FormControl>
                <FormLabel>Judge</FormLabel>
                <Select
                    value={editedIncident.judgeId}
                    disabled={isLoading}
                    onChange={(e) =>
                        setEditedIncident({
                            ...editedIncident,
                            judgeId: e.target.value,
                        })
                    }
                >
                    {persons.map((person) => (
                        <option key={person.id} value={person.id}>
                            {person.name} ({person.registrantId})
                        </option>
                    ))}
                </Select>
            </FormControl>
            <FormControl>
                <FormLabel>Comment</FormLabel>
                <Input
                    placeholder="Comment"
                    _placeholder={{ color: "white" }}
                    value={editedIncident.comment}
                    disabled={isLoading}
                    onChange={(e) =>
                        setEditedIncident({
                            ...editedIncident,
                            comment: e.target.value,
                        })
                    }
                />
            </FormControl>
            <PenaltySelect
                value={editedIncident.penalty}
                onChange={(value) =>
                    setEditedIncident({
                        ...editedIncident,
                        penalty: value,
                    })
                }
                disabled={isLoading}
            />
            <Checkbox
                isChecked={editedIncident.isResolved}
                onChange={(e) =>
                    setEditedIncident({
                        ...editedIncident,
                        isResolved: e.target.checked,
                    })
                }
            >
                Is resolved
            </Checkbox>
            <Checkbox
                isChecked={editedIncident.extraGiven}
                onChange={(e) =>
                    setEditedIncident({
                        ...editedIncident,
                        extraGiven: e.target.checked,
                    })
                }
            >
                Extra given
            </Checkbox>
            <Button
                colorScheme="green"
                width={{ base: "100%", md: "20%" }}
                onClick={() => handleSubmit(editedIncident)}
            >
                Save
            </Button>
        </Box>
    );
};

export default IncidentPage;
