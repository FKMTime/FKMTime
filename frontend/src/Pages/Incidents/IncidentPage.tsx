import {
    Box,
    Button,
    FormControl,
    FormLabel,
    Heading,
    Input,
    Text,
    useToast,
} from "@chakra-ui/react";
import { useConfirm } from "chakra-ui-confirm";
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import AttemptResultInput from "@/Components/AttemptResultInput";
import LoadingPage from "@/Components/LoadingPage";
import PenaltySelect from "@/Components/PenaltySelect";
import Select from "@/Components/Select";
import { competitionAtom } from "@/logic/atoms";
import { deleteAttempt, getIncidentById, updateAttempt } from "@/logic/attempt";
import { DNF_VALUE } from "@/logic/constants";
import {
    AttemptStatus,
    Incident,
    Person,
    QuickAction,
} from "@/logic/interfaces";
import { getAllPersons, getPersonNameAndRegistrantId } from "@/logic/persons";
import { getQuickActions } from "@/logic/quickActions.ts";
import { checkTimeLimit } from "@/logic/results";
import { msToString } from "@/logic/utils";

const IncidentPage = () => {
    const navigate = useNavigate();
    const competition = useAtomValue(competitionAtom);
    const toast = useToast();
    const confirm = useConfirm();
    const { id } = useParams<{ id: string }>();
    const [persons, setPersons] = useState<Person[]>([]);
    const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
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
        getQuickActions().then((data) => {
            setQuickActions(data);
        });
    }, []);

    if (!editedIncident) {
        return <LoadingPage />;
    }

    const a7g = () => {
        const data = {
            ...editedIncident,
            status: AttemptStatus.EXTRA_GIVEN,
            comment: "A7G",
            submitToWcaLive: false,
            updateReplacedBy: false,
        };
        setEditedIncident(data);
        handleSubmit(data);
    };

    const judgeFault = () => {
        const data = {
            ...editedIncident,
            status: AttemptStatus.EXTRA_GIVEN,
            comment: "Judge fault",
            submitToWcaLive: false,
            updateReplacedBy: false,
        };
        setEditedIncident(data);
        handleSubmit(data);
    };

    const handleSubmit = async (data: Incident) => {
        if (
            data.value === 0 &&
            data.penalty === 0 &&
            data.status !== AttemptStatus.EXTRA_GIVEN
        ) {
            return toast({
                title: "Error",
                description:
                    "The time must be greater than 0 or DNF penalty should be applied",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        }
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

    const handleDelete = async () => {
        confirm({
            title: "Are you sure you want to delete this attempt?",
            description: "This action cannot be undone.",
            onConfirm: async () => {
                setIsLoading(true);
                const status = await deleteAttempt(editedIncident.id);
                if (status === 204) {
                    toast({
                        title: "Successfully deleted attempt.",
                        status: "success",
                        duration: 9000,
                        isClosable: true,
                    });
                    navigate("/incidents");
                } else {
                    toast({
                        title: "Error",
                        description: "Something went wrong",
                        status: "error",
                        duration: 9000,
                        isClosable: true,
                    });
                }
                setIsLoading(false);
            },
        });
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
            {quickActions.map((quickAction) => (
                <Button
                    key={quickAction.id}
                    colorScheme="gray"
                    onClick={() =>
                        handleSubmit({
                            ...editedIncident,
                            status: quickAction.giveExtra
                                ? AttemptStatus.EXTRA_GIVEN
                                : AttemptStatus.RESOLVED,
                            comment: quickAction.comment || "",
                            submitToWcaLive: !quickAction.giveExtra,
                        })
                    }
                >
                    {quickAction.name}
                </Button>
            ))}
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
            <FormControl>
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
            {editedIncident.inspectionTime ? (
                <Text>
                    Inspection time: {msToString(editedIncident.inspectionTime)}
                </Text>
            ) : null}
            <FormControl>
                <FormLabel>Judge</FormLabel>
                <Select
                    value={editedIncident.judgeId || ""}
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
                            {getPersonNameAndRegistrantId(person)}
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
            <Box display="flex" gap="5" flexDirection="column">
                <Button
                    colorScheme="green"
                    onClick={() =>
                        handleSubmit({
                            ...editedIncident,
                            status: AttemptStatus.RESOLVED,
                            submitToWcaLive: true,
                        })
                    }
                >
                    Mark as resolved
                </Button>
                <Button
                    colorScheme="blue"
                    onClick={() =>
                        handleSubmit({
                            ...editedIncident,
                            status: AttemptStatus.EXTRA_GIVEN,
                        })
                    }
                >
                    Save and give extra
                </Button>
                <Button colorScheme="red" onClick={handleDelete}>
                    Delete attempt
                </Button>
            </Box>
        </Box>
    );
};

export default IncidentPage;
