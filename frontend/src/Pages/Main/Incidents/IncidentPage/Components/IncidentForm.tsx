import {
    Box,
    Button,
    FormControl,
    FormLabel,
    Input,
    Text,
    useToast,
} from "@chakra-ui/react";
import { useAtomValue } from "jotai";

import AttemptResultInput from "@/Components/AttemptResultInput";
import PenaltySelect from "@/Components/PenaltySelect";
import PersonAutocomplete from "@/Components/PersonAutocomplete";
import { competitionAtom } from "@/logic/atoms";
import { DNF_VALUE } from "@/logic/constants";
import { AttemptStatus, Incident } from "@/logic/interfaces";
import { getPersonNameAndRegistrantId } from "@/logic/persons";
import { milisecondsToClockFormat } from "@/logic/resultFormatters";
import { checkTimeLimit } from "@/logic/results";

interface IncidentFormProps {
    editedIncident: Incident;
    setEditedIncident: (incident: Incident) => void;
    isLoading: boolean;
    handleSubmit: (incident: Incident) => void;
    handleDelete: () => void;
}

const IncidentForm = ({
    editedIncident,
    setEditedIncident,
    isLoading,
    handleSubmit,
    handleDelete,
}: IncidentFormProps) => {
    const competition = useAtomValue(competitionAtom);
    const toast = useToast();

    return (
        <>
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
                    Inspection time:{" "}
                    {milisecondsToClockFormat(editedIncident.inspectionTime)}
                </Text>
            ) : null}
            <FormControl>
                <FormLabel>Judge</FormLabel>
                <PersonAutocomplete
                    onSelect={(person) =>
                        setEditedIncident({
                            ...editedIncident,
                            judgeId: person.id,
                        })
                    }
                    value={editedIncident.judge}
                    autoFocus
                    disabled={isLoading}
                />
            </FormControl>
            {editedIncident.scrambler ? (
                <Text>
                    Scrambler:{" "}
                    {getPersonNameAndRegistrantId(editedIncident.scrambler)}
                </Text>
            ) : null}
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
        </>
    );
};

export default IncidentForm;
