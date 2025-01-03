import { Box } from "@chakra-ui/react";
import { Round, RoundFormat } from "@wca/helpers";
import { useEffect, useState } from "react";
import { MdDelete } from "react-icons/md";

import AttemptResultInput from "@/Components/AttemptResultInput";
import { Modal } from "@/Components/Modal";
import PlusButton from "@/Components/PlusButton";
import RoundedIconButton from "@/Components/RoundedIconButton";
import Select from "@/Components/Select";
import { Button } from "@/Components/ui/button";
import { Checkbox } from "@/Components/ui/checkbox";
import { Field } from "@/Components/ui/field";
import { toaster } from "@/Components/ui/toaster";
import { CUTOFF_ALLOWED } from "@/logic/constants";
import { getUnofficialEvents } from "@/logic/events";
import { Event } from "@/logic/interfaces";
import { createUnofficialEvent } from "@/logic/unofficialEvents";

import {
    updateCumulativeLimit,
    updateCutoffInRounds,
    updateFormatInRounds,
    updateTimeLimitInRounds,
} from "../utils";

interface CreateUnofficialEventModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CreateUnofficialEventModal = ({
    isOpen,
    onClose,
}: CreateUnofficialEventModalProps) => {
    const [isLoading, setIsLoading] = useState(false);
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string>("");
    const [rounds, setRounds] = useState<Round[]>([]);

    const handleSubmit = async () => {
        setIsLoading(true);
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
            toaster.create({
                title: "Successfully added unofficial event",
                type: "success",
            });
            setRounds([]);
            setSelectedEventId("");
            onClose();
        } else if (status === 409) {
            toaster.create({
                title: "Error",
                description: "Event already exists",
                type: "error",
            });
        } else {
            toaster.create({
                title: "Error",
                description: "Something went wrong",
                type: "error",
            });
        }
        setIsLoading(false);
    };

    const addRound = () => {
        if (rounds.length >= 4) {
            return toaster.create({
                title: "Error",
                description: "You cannot add more than 4 rounds",
                type: "error",
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
            return updateTimeLimitInRounds(roundId, value, prev);
        });
    };

    const updateFormat = (roundId: string, value: RoundFormat) => {
        setRounds((prev) => {
            return updateFormatInRounds(roundId, value, prev);
        });
    };

    const updateCutoff = (roundId: string, value: number) => {
        setRounds((prev) => {
            return updateCutoffInRounds(roundId, value, prev);
        });
    };

    const updateCumulative = (roundId: string, value: boolean) => {
        setRounds((prev) => {
            return updateCumulativeLimit(roundId, value, prev);
        });
    };

    useEffect(() => {
        getUnofficialEvents().then((data) => {
            setEvents(data);
        });
    }, []);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add unofficial event">
            <Box display="flex" flexDirection="column" gap="5">
                <Field required label="Event">
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
                </Field>
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
                    <Field key={index} label={`Round ${index + 1}`}>
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
                            <Field>
                                <Checkbox
                                    checked={
                                        round.timeLimit?.cumulativeRoundIds &&
                                        round.timeLimit.cumulativeRoundIds
                                            .length > 0
                                    }
                                    disabled={isLoading}
                                    onCheckedChange={(e) =>
                                        updateCumulative(round.id, !!e.checked)
                                    }
                                >
                                    Cumulative
                                </Checkbox>
                            </Field>
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
                    </Field>
                ))}
                <Box
                    display="flex"
                    flexDirection="row"
                    justifyContent="end"
                    gap="5"
                >
                    {!isLoading && (
                        <Button colorPalette="red" onClick={onClose}>
                            Cancel
                        </Button>
                    )}
                    <Button
                        colorPalette="green"
                        loading={isLoading}
                        disabled={rounds.length === 0}
                        onClick={handleSubmit}
                    >
                        Add
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
};

export default CreateUnofficialEventModal;
