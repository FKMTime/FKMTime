import {
    Box,
    Button,
    Checkbox,
    FormControl,
    FormLabel,
    Input,
    Text,
    useToast,
} from "@chakra-ui/react";
import { Modal } from "./Modal";
import { useEffect, useState } from "react";
import { Attempt, Person, Result } from "../../logic/interfaces";
import { updateAttempt } from "../../logic/attempt";
import { useAtomValue } from "jotai";
import { competitionAtom } from "../../logic/atoms";
import { checkTimeLimit } from "../../logic/results";
import { getAllPersons } from "../../logic/persons";
import { msToString } from "../../logic/utils.ts";
import AttemptResultInput from "../AttemptResultInput.tsx";
import { DNF_VALUE } from "../../logic/constants.ts";
import PenaltySelect from "../PenaltySelect.tsx";
import Select from "../../Components/Select.tsx";

interface EditAttemptModalProps {
    isOpen: boolean;
    onClose: () => void;
    attempt: Attempt;
    result: Result;
}

const EditAttemptModal: React.FC<EditAttemptModalProps> = ({
    isOpen,
    onClose,
    attempt,
    result,
}) => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const competition = useAtomValue(competitionAtom);
    const [persons, setPersons] = useState<Person[]>([]);

    const [editedAttempt, setEditedAttempt] = useState<Attempt>(attempt);
    const [shouldResubmitToWcaLive, setShouldResubmitToWcaLive] =
        useState<boolean>(false);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        setIsLoading(true);
        event.preventDefault();

        const status = await updateAttempt({
            ...editedAttempt,
            shouldResubmitToWcaLive,
        });
        if (status === 200) {
            toast({
                title: "Successfully updated attempt.",
                status: "success",
                duration: 9000,
                isClosable: true,
            });
            onClose();
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
    };

    useEffect(() => {
        const fetchPersonsData = async () => {
            const data = await getAllPersons();
            setPersons(data);
        };
        if (isOpen) {
            fetchPersonsData();
        }
    }, [isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit attempt">
            <Box
                display="flex"
                flexDirection="column"
                gap="5"
                as="form"
                onSubmit={handleSubmit}
            >
                <FormControl isRequired>
                    <FormLabel>Attempt number</FormLabel>
                    <Input
                        placeholder="Attempt number"
                        _placeholder={{ color: "white" }}
                        value={editedAttempt.attemptNumber}
                        disabled={isLoading}
                        onChange={(e) =>
                            setEditedAttempt({
                                ...editedAttempt,
                                attemptNumber: +e.target.value,
                            })
                        }
                    />
                </FormControl>
                <Checkbox
                    isChecked={editedAttempt.isExtraAttempt}
                    onChange={(e) =>
                        setEditedAttempt({
                            ...editedAttempt,
                            isExtraAttempt: e.target.checked,
                        })
                    }
                >
                    Is extra attempt
                </Checkbox>
                <FormControl isRequired>
                    <FormLabel>Time</FormLabel>
                    <AttemptResultInput
                        value={editedAttempt.value}
                        disabled={isLoading}
                        onChange={(newValue) => {
                            if (!competition) {
                                setEditedAttempt({
                                    ...editedAttempt,
                                    value: newValue,
                                });
                                return;
                            }
                            const isLimitPassed = checkTimeLimit(
                                newValue,
                                competition?.wcif,
                                result.roundId
                            );
                            if (!isLimitPassed) {
                                toast({
                                    title: "This attempt is over the time limit.",
                                    description: "This time is DNF.",
                                    status: "error",
                                    duration: 9000,
                                    isClosable: true,
                                });
                                setEditedAttempt({
                                    ...editedAttempt,
                                    value: newValue,
                                    penalty: DNF_VALUE,
                                });
                                return;
                            }
                            setEditedAttempt({
                                ...editedAttempt,
                                value: newValue,
                            });
                        }}
                    />
                </FormControl>
                {attempt.inspectionTime && (
                    <Text>
                        Inspection time: {msToString(attempt.inspectionTime)}
                    </Text>
                )}
                <PenaltySelect
                    value={editedAttempt.penalty}
                    onChange={(value) =>
                        setEditedAttempt({
                            ...editedAttempt,
                            penalty: value,
                        })
                    }
                    disabled={isLoading}
                />
                <FormControl>
                    <FormLabel>Judge</FormLabel>
                    <Select
                        value={editedAttempt.judgeId}
                        disabled={isLoading}
                        onChange={(e) =>
                            setEditedAttempt({
                                ...editedAttempt,
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
                        value={editedAttempt.comment}
                        disabled={isLoading}
                        onChange={(e) =>
                            setEditedAttempt({
                                ...editedAttempt,
                                comment: e.target.value,
                            })
                        }
                    />
                </FormControl>
                {editedAttempt.extraGiven && (
                    <FormControl>
                        <FormLabel>Replaced by</FormLabel>
                        <Input
                            placeholder="Replaced by"
                            _placeholder={{ color: "white" }}
                            value={editedAttempt.replacedBy}
                            disabled={isLoading}
                            onChange={(e) =>
                                setEditedAttempt({
                                    ...editedAttempt,
                                    replacedBy: +e.target.value,
                                })
                            }
                        />
                    </FormControl>
                )}
                <Checkbox
                    isChecked={editedAttempt.isDelegate}
                    onChange={(e) =>
                        setEditedAttempt({
                            ...editedAttempt,
                            isDelegate: e.target.checked,
                        })
                    }
                >
                    Is delegate case
                </Checkbox>
                {editedAttempt.isDelegate && (
                    <>
                        <Checkbox
                            isChecked={editedAttempt.isResolved}
                            onChange={(e) =>
                                setEditedAttempt({
                                    ...editedAttempt,
                                    isResolved: e.target.checked,
                                })
                            }
                        >
                            Is resolved
                        </Checkbox>
                        <Checkbox
                            isChecked={editedAttempt.extraGiven}
                            onChange={(e) =>
                                setEditedAttempt({
                                    ...editedAttempt,
                                    extraGiven: e.target.checked,
                                })
                            }
                        >
                            Extra given
                        </Checkbox>
                    </>
                )}
                <Checkbox
                    isChecked={shouldResubmitToWcaLive}
                    onChange={(e) =>
                        setShouldResubmitToWcaLive(e.target.checked)
                    }
                >
                    Resubmit to WCA Live
                </Checkbox>
                <Box
                    display="flex"
                    flexDirection="row"
                    justifyContent="end"
                    gap="5"
                >
                    {!isLoading && (
                        <Button colorScheme="red" onClick={onClose}>
                            Cancel
                        </Button>
                    )}
                    <Button
                        colorScheme="green"
                        type="submit"
                        isLoading={isLoading}
                    >
                        Save
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
};
export default EditAttemptModal;
