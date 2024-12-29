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
import { FormEvent, useEffect, useState } from "react";

import AttemptResultInput from "@/Components/AttemptResultInput";
import Autocomplete from "@/Components/Autocomplete";
import { Modal } from "@/Components/Modal";
import PenaltySelect from "@/Components/PenaltySelect";
import Select from "@/Components/Select";
import { competitionAtom } from "@/logic/atoms";
import { updateAttempt } from "@/logic/attempt";
import { DNF_VALUE } from "@/logic/constants";
import { getAllDevices } from "@/logic/devices.ts";
import {
    Attempt,
    AttemptStatus,
    AttemptType,
    Device,
    DeviceType,
    Person,
    Result,
} from "@/logic/interfaces";
import { getAllPersons, getPersonNameAndRegistrantId } from "@/logic/persons";
import { milisecondsToClockFormat } from "@/logic/resultFormatters";
import { checkTimeLimit } from "@/logic/results";
import {
    getSubmissionPlatformName,
    prettyAttemptStatus,
    prettyAttemptType,
} from "@/logic/utils";

interface EditAttemptModalProps {
    isOpen: boolean;
    onClose: () => void;
    attempt: Attempt;
    result: Result;
}

const EditAttemptModal = ({
    isOpen,
    onClose,
    attempt,
    result,
}: EditAttemptModalProps) => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const competition = useAtomValue(competitionAtom);
    const [persons, setPersons] = useState<Person[]>([]);
    const [devices, setDevices] = useState<Device[]>([]);

    const [editedAttempt, setEditedAttempt] = useState<Attempt>(attempt);

    const submissionPlatform = getSubmissionPlatformName(result.eventId);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        setIsLoading(true);
        event.preventDefault();

        const status = await updateAttempt(editedAttempt);
        if (status === 200) {
            toast({
                title: `Successfully updated attempt and resubmitted result to ${submissionPlatform}.`,
                status: "success",
            });
            onClose();
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                status: "error",
            });
        }
        setIsLoading(false);
    };

    useEffect(() => {
        const fetchPersonsData = async () => {
            const data = await getAllPersons();
            setPersons(data);
        };
        const fetchDevicesData = async () => {
            const data = await getAllDevices(DeviceType.STATION);
            setDevices(data);
        };
        if (isOpen) {
            fetchPersonsData();
            fetchDevicesData();
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
                <FormControl isRequired>
                    <FormLabel>Attempt type</FormLabel>
                    <Select
                        disabled={isLoading}
                        value={editedAttempt.type}
                        onChange={(e) =>
                            setEditedAttempt({
                                ...editedAttempt,
                                type: e.target.value as AttemptType,
                            })
                        }
                    >
                        {(
                            Object.keys(AttemptType) as Array<
                                keyof typeof AttemptType
                            >
                        ).map((key) => (
                            <option key={key} value={key}>
                                {prettyAttemptType(key as AttemptType)}
                            </option>
                        ))}
                    </Select>
                </FormControl>
                <FormControl isRequired>
                    <FormLabel>Attempt status</FormLabel>
                    <Select
                        disabled={isLoading}
                        value={editedAttempt.status}
                        onChange={(e) =>
                            setEditedAttempt({
                                ...editedAttempt,
                                status: e.target.value as AttemptStatus,
                            })
                        }
                    >
                        {(
                            Object.keys(AttemptStatus) as Array<
                                keyof typeof AttemptStatus
                            >
                        ).map((key) => (
                            <option key={key} value={key}>
                                {prettyAttemptStatus(key as AttemptStatus)}
                            </option>
                        ))}
                    </Select>
                </FormControl>
                <FormControl>
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
                {attempt.inspectionTime ? (
                    <Text>
                        Inspection time:{" "}
                        {milisecondsToClockFormat(attempt.inspectionTime)}
                    </Text>
                ) : null}
                {attempt.originalTime ? (
                    <Text>
                        Original time:{" "}
                        {milisecondsToClockFormat(attempt.originalTime)}
                    </Text>
                ) : null}
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
                    <Autocomplete
                        options={persons}
                        selectedValue={editedAttempt.judge || null}
                        onOptionSelect={(person) => {
                            setEditedAttempt({
                                ...editedAttempt,
                                judgeId: person.id,
                                judge: person,
                            });
                        }}
                        getOptionLabel={(option: Person) =>
                            getPersonNameAndRegistrantId(option)
                        }
                    />
                </FormControl>
                {attempt.scrambler ? (
                    <Text>
                        Scrambler:{" "}
                        {getPersonNameAndRegistrantId(attempt.scrambler)}
                    </Text>
                ) : null}
                <FormControl>
                    <FormLabel>Device</FormLabel>
                    <Select
                        disabled={isLoading}
                        value={editedAttempt.deviceId || ""}
                        placeholder="Select device"
                        onChange={(e) =>
                            setEditedAttempt({
                                ...editedAttempt,
                                deviceId: e.target.value,
                            })
                        }
                    >
                        {devices.map((device) => (
                            <option key={device.id} value={device.id}>
                                {device.name}
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
                {editedAttempt.status === AttemptStatus.EXTRA_GIVEN && (
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
