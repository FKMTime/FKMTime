import { Box } from "@chakra-ui/react";
import { RoundFormat } from "@wca/helpers";
import { useState } from "react";
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
import { UnofficialEvent } from "@/logic/interfaces";
import { updateUnofficialEvent } from "@/logic/unofficialEvents";

interface EditUnofficialEventModalProps {
    isOpen: boolean;
    onClose: () => void;
    unofficialEvent: UnofficialEvent;
}

const EditUnofficialEventModal = ({
    isOpen,
    onClose,
    unofficialEvent,
}: EditUnofficialEventModalProps) => {
    const [isLoading, setIsLoading] = useState(false);
    const [editedEvent, setEditedEvent] =
        useState<UnofficialEvent>(unofficialEvent);

    const handleSubmit = async () => {
        setIsLoading(true);
        const roundsToSend = editedEvent.wcif.rounds.map((round) => {
            if (round.cutoff?.attemptResult === 0) {
                round.cutoff = null;
            }
            return round;
        });
        const eventToSend = {
            ...editedEvent,
            wcif: { ...editedEvent.wcif, rounds: roundsToSend },
        };
        const status = await updateUnofficialEvent(eventToSend);
        if (status === 200) {
            toaster.create({
                title: "Successfully updated unofficial event",
                type: "success",
            });
            onClose();
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
        if (editedEvent.wcif.rounds.length >= 4) {
            return toaster.create({
                title: "Error",
                description: "You cannot add more than 4 rounds",
                type: "error",
            });
        }
        setEditedEvent((prev) => {
            const newRounds = [...prev.wcif.rounds];
            newRounds.push({
                id: `${unofficialEvent.eventId}-r${newRounds.length + 1}`,
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
            return { ...prev, wcif: { ...prev.wcif, rounds: newRounds } };
        });
    };

    const deleteLastRound = () => {
        if (editedEvent.wcif.rounds.length === 0) {
            return;
        }
        setEditedEvent((prev) => {
            const newRounds = [...prev.wcif.rounds];
            newRounds.pop();
            return { ...prev, wcif: { ...prev.wcif, rounds: newRounds } };
        });
    };

    const updateTimeLimit = (roundId: string, value: number) => {
        setEditedEvent((prev) => {
            const newRounds = [...prev.wcif.rounds];
            const round = newRounds.find((r) => r.id === roundId);
            if (!round) {
                return prev;
            }
            if (!round.timeLimit) {
                round.timeLimit = {
                    centiseconds: value,
                    cumulativeRoundIds: [],
                };
                return { ...prev, wcif: { ...prev.wcif, rounds: newRounds } };
            } else {
                round.timeLimit.centiseconds = value;
            }
            return { ...prev, wcif: { ...prev.wcif, rounds: newRounds } };
        });
    };

    const updateFormat = (roundId: string, value: RoundFormat) => {
        setEditedEvent((prev) => {
            const newRounds = [...prev.wcif.rounds];
            const round = newRounds.find((r) => r.id === roundId);
            if (!round) {
                return prev;
            }
            round.format = value;
            if (round.cutoff) {
                if (!CUTOFF_ALLOWED.includes(value)) {
                    round.cutoff = null;
                } else {
                    round.cutoff.numberOfAttempts = value === "a" ? 2 : 1;
                }
            }
            return { ...prev, wcif: { ...prev.wcif, rounds: newRounds } };
        });
    };

    const updateCutoff = (roundId: string, value: number) => {
        setEditedEvent((prev) => {
            const newRounds = [...prev.wcif.rounds];
            const round = newRounds.find((r) => r.id === roundId);
            if (!round) {
                return prev;
            }
            if (!round.cutoff) {
                round.cutoff = {
                    attemptResult: value,
                    numberOfAttempts: round.format === "a" ? 2 : 1,
                };
            } else {
                round.cutoff.attemptResult = value;
            }
            return { ...prev, wcif: { ...prev.wcif, rounds: newRounds } };
        });
    };

    const updateCumulative = (roundId: string, value: boolean) => {
        setEditedEvent((prev) => {
            const newRounds = [...prev.wcif.rounds];
            const round = newRounds.find((r) => r.id === roundId);
            if (!round) {
                return prev;
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
            return { ...prev, wcif: { ...prev.wcif, rounds: newRounds } };
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit rounds details">
            <Box display="flex" flexDirection="column" gap="5">
                <Box display="flex" gap="3">
                    {editedEvent.wcif.rounds.length < 4 && (
                        <PlusButton
                            onClick={addRound}
                            title="Add round"
                            aria-label="Add"
                        />
                    )}
                    {editedEvent.wcif.rounds.length > 1 && (
                        <RoundedIconButton
                            icon={<MdDelete />}
                            onClick={deleteLastRound}
                            title="Delete last round"
                            ariaLabel="Delete"
                        />
                    )}
                </Box>
                {editedEvent.wcif.rounds.map((round, index) => (
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
                    <Button
                        colorPalette="red"
                        onClick={onClose}
                        loading={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        colorPalette="green"
                        loading={isLoading}
                        disabled={editedEvent.wcif.rounds.length === 0}
                        onClick={handleSubmit}
                    >
                        Update
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
};

export default EditUnofficialEventModal;
