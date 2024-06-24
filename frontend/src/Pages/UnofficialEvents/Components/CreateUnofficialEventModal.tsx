import {
    Box,
    Button,
    Checkbox,
    FormControl,
    FormLabel,
    useToast,
} from "@chakra-ui/react";
import { Round, RoundFormat } from "@wca/helpers";
import { FormEvent, useEffect, useState } from "react";
import { MdDelete } from "react-icons/md";

import AttemptResultInput from "@/Components/AttemptResultInput";
import { Modal } from "@/Components/Modal";
import PlusButton from "@/Components/PlusButton";
import RoundedIconButton from "@/Components/RoundedIconButton";
import Select from "@/Components/Select";
import { CUTOFF_ALLOWED } from "@/logic/constants";
import { createUnofficialEvent, getUnofficialEvents } from "@/logic/events";
import { Event } from "@/logic/interfaces";

interface CreateUnofficialEventModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CreateUnofficialEventModal = ({
    isOpen,
    onClose,
}: CreateUnofficialEventModalProps) => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string>("");
    const [rounds, setRounds] = useState<Round[]>([]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        setIsLoading(true);
        event.preventDefault();
        const roundsToSend = rounds.map((round) => {
            if (round.cutoff?.attemptResult === 0) {
                round.cutoff = null;
            }
            return round;
        });
        const status = await createUnofficialEvent(
            selectedEventId,
            roundsToSend
        );
        if (status === 201) {
            toast({
                title: "Successfully added unofficial event",
                status: "success",
                duration: 9000,
                isClosable: true,
            });
            onClose();
        } else if (status === 409) {
            toast({
                title: "Error",
                description: "Event already exists",
                status: "error",
                duration: 9000,
                isClosable: true,
            });
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

    const addRound = () => {
        if (rounds.length >= 4) {
            return toast({
                title: "Error",
                description: "You cannot add more than 4 rounds",
                status: "error",
                duration: 9000,
                isClosable: true,
            });
        }
        setRounds((prev) => {
            const newRounds = [...prev];
            newRounds.push({
                id: `${selectedEventId}-r${newRounds.length + 1}`,
                timeLimit: {
                    centiseconds: 60000,
                    cumulativeRoundIds: [],
                },
                cutoff: null,
                results: [],
                format: "a",
                advancementCondition: null,
                extensions: [],
            });
            return newRounds;
        });
    };

    const deleteLastRound = () => {
        if (rounds.length === 0) {
            return;
        }
        setRounds((prev) => {
            const newRounds = [...prev];
            newRounds.pop();
            return newRounds;
        });
    };

    const updateSelectedEventId = (value: string) => {
        setSelectedEventId(value);
        setRounds([]);
    };

    const updateTimeLimit = (roundId: string, value: number) => {
        setRounds((prev) => {
            const newRounds = [...prev];
            const round = newRounds.find((r) => r.id === roundId);
            if (!round) {
                return newRounds;
            }
            if (!round.timeLimit) {
                round.timeLimit = {
                    centiseconds: value,
                    cumulativeRoundIds: [],
                };
                return newRounds;
            } else {
                round.timeLimit.centiseconds = value;
            }
            return newRounds;
        });
    };

    const updateFormat = (roundId: string, value: RoundFormat) => {
        setRounds((prev) => {
            const newRounds = [...prev];
            const round = newRounds.find((r) => r.id === roundId);
            if (!round) {
                return newRounds;
            }
            round.format = value;
            if (round.cutoff) {
                if (!CUTOFF_ALLOWED.includes(value)) {
                    round.cutoff = null;
                } else {
                    round.cutoff.numberOfAttempts = value === "a" ? 2 : 1;
                }
            }
            return newRounds;
        });
    };

    const updateCutoff = (roundId: string, value: number) => {
        setRounds((prev) => {
            const newRounds = [...prev];
            const round = newRounds.find((r) => r.id === roundId);
            if (!round) {
                return newRounds;
            }
            round.cutoff = {
                numberOfAttempts: round.format === "a" ? 2 : 1,
                attemptResult: value,
            };
            return newRounds;
        });
    };

    const updateCumulative = (roundId: string, value: boolean) => {
        setRounds((prev) => {
            const newRounds = [...prev];
            const round = newRounds.find((r) => r.id === roundId);
            if (!round) {
                return newRounds;
            }
            if (!round.timeLimit) {
                round.timeLimit = {
                    centiseconds: 60000,
                    cumulativeRoundIds: [],
                };
            }
            if (value) {
                round.timeLimit.cumulativeRoundIds.push(roundId);
            } else {
                round.timeLimit.cumulativeRoundIds = [];
            }
            return newRounds;
        });
    };

    useEffect(() => {
        getUnofficialEvents().then((data) => {
            setEvents(data);
        });
    }, []);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add unofficial event">
            <Box
                display="flex"
                flexDirection="column"
                gap="5"
                as="form"
                onSubmit={handleSubmit}
            >
                <FormControl isRequired>
                    <FormLabel>Event</FormLabel>
                    <Select
                        placeholder="Select event"
                        value={selectedEventId}
                        onChange={(e) => updateSelectedEventId(e.target.value)}
                        disabled={isLoading}
                    >
                        {events.map((event) => (
                            <option key={event.id} value={event.id}>
                                {event.name}{" "}
                            </option>
                        ))}
                    </Select>
                </FormControl>
                <Box display="flex" gap="3">
                    {selectedEventId && (
                        <PlusButton
                            onClick={addRound}
                            title="Add round"
                            aria-label="Add"
                        />
                    )}
                    {rounds.length > 0 && (
                        <RoundedIconButton
                            icon={<MdDelete />}
                            onClick={deleteLastRound}
                            title="Delete last round"
                            ariaLabel="Delete"
                        />
                    )}
                </Box>
                {rounds.map((round, index) => (
                    <FormControl key={index}>
                        <Box display="flex">
                            <FormLabel>{`Round ${index + 1}`}</FormLabel>
                        </Box>
                        <Box display="flex" flexDirection="column" gap="3">
                            <Select
                                disabled={isLoading}
                                value={round.format}
                                onChange={(e) =>
                                    updateFormat(
                                        round.id,
                                        e.target.value as RoundFormat
                                    )
                                }
                            >
                                <option value="a">Average of 5</option>
                                <option value="m">Mean of 3</option>
                                <option value="3">Best of 3</option>
                            </Select>
                            <AttemptResultInput
                                disabled={isLoading}
                                placeholder="Time limit"
                                value={round.timeLimit?.centiseconds ?? 0}
                                onChange={(value) =>
                                    updateTimeLimit(round.id, value)
                                }
                            />
                            <FormControl>
                                <Checkbox
                                    isChecked={
                                        round.timeLimit?.cumulativeRoundIds &&
                                        round.timeLimit.cumulativeRoundIds
                                            .length > 0
                                    }
                                    isDisabled={isLoading}
                                    onChange={(e) =>
                                        updateCumulative(
                                            round.id,
                                            e.target.checked
                                        )
                                    }
                                >
                                    Cumulative
                                </Checkbox>
                            </FormControl>
                            {CUTOFF_ALLOWED.includes(round.format) && (
                                <AttemptResultInput
                                    disabled={isLoading}
                                    placeholder="Cutoff"
                                    value={round.cutoff?.attemptResult ?? 0}
                                    onChange={(value) =>
                                        updateCutoff(round.id, value)
                                    }
                                />
                            )}
                        </Box>
                    </FormControl>
                ))}
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
                        isDisabled={rounds.length === 0}
                    >
                        Add
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
};

export default CreateUnofficialEventModal;
