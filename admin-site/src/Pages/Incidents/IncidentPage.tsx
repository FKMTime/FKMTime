import {Box, Button, Checkbox, FormControl, FormLabel, Heading, Input, Select, useToast} from "@chakra-ui/react";
import {useNavigate, useParams} from "react-router-dom";
import {useEffect, useState} from "react";
import {Incident, Person} from "../../logic/interfaces.ts";
import {getIncidentById, updateAttempt} from "../../logic/attempt.ts";
import LoadingPage from "../../Components/LoadingPage.tsx";
import {getAllPersons} from "../../logic/persons.ts";

const IncidentPage = () => {
    const navigate = useNavigate();
    const toast = useToast();
    const {id} = useParams<{ id: string }>();
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
        return <LoadingPage/>;
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
            navigate('/incidents');
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
        <Box display="flex" flexDirection="column" gap="5" width={{base: "100%", md: "20%"}}>
            <Button colorScheme="yellow"
                    onClick={() => navigate(`/results/${editedIncident?.result.id}`)}>
                All attempts from this average
            </Button>
            <Heading size="lg">Quick actions</Heading>
            <Button colorScheme="purple" onClick={a7g}>A7G</Button>
            <Button colorScheme="blue" onClick={judgeFault}>Judge fault</Button>
            <Button colorScheme="green" onClick={ok}>OK</Button>
            <FormControl isRequired>
                <FormLabel>Attempt number</FormLabel>
                <Input
                    placeholder="Attempt number"
                    _placeholder={{color: "white"}}
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
                <Input
                    placeholder="Time"
                    _placeholder={{color: "white"}}
                    value={editedIncident.value}
                    disabled={isLoading}
                    onChange={(e) => {
                        setEditedIncident({
                            ...editedIncident,
                            value: +e.target.value,
                        });
                    }}
                />
            </FormControl>
            <FormControl>
                <FormLabel>Judge</FormLabel>
                <Select
                    placeholder="Select judge"
                    _placeholder={{color: "white"}}
                    value={editedIncident.judgeId}
                    disabled={isLoading}
                    onChange={(e) =>
                        setEditedIncident({
                            ...editedIncident,
                            judgeId: +e.target.value,
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
                    _placeholder={{color: "white"}}
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
            <FormControl>
                <FormLabel>Penalty</FormLabel>
                <Select
                    placeholder="Select penalty"
                    _placeholder={{color: "white"}}
                    value={editedIncident.penalty}
                    disabled={isLoading}
                    onChange={(e) =>
                        setEditedIncident({
                            ...editedIncident,
                            penalty: +e.target.value,
                        })
                    }
                >
                    <option value={0}>No penalty</option>
                    <option value={2}>+2</option>
                    <option value={-1}>DNF</option>
                    <option value={-2}>DNS</option>
                    <option value={4}>+4</option>
                    <option value={6}>+6</option>
                    <option value={8}>+8</option>
                    <option value={10}>+10</option>
                    <option value={12}>+12</option>
                    <option value={14}>+14</option>
                    <option value={16}>+16</option>
                </Select>
            </FormControl>
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
                width={{base: "100%", md: "20%"}}
                onClick={() => handleSubmit(editedIncident)}
            >
                Save
            </Button>
        </Box>
    )
};

export default IncidentPage;
