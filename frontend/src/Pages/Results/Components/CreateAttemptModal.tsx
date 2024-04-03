import {
    Alert,
    AlertIcon,
    Box,
    Button,
    Checkbox,
    FormControl,
    FormLabel,
    Input,
    useToast,
} from "@chakra-ui/react";
import { TimeLimit } from "@wca/helpers";
import { FormEvent, useEffect, useState } from "react";

import AttemptResultInput from "@/Components/AttemptResultInput";
import { Modal } from "@/Components/Modal";
import PenaltySelect from "@/Components/PenaltySelect";
import PersonAutocomplete from "@/Components/PersonAutocomplete";
import Select from "@/Components/Select";
import { createAttempt } from "@/logic/attempt";
import { DNF_VALUE } from "@/logic/constants";
import { getAllDevices } from "@/logic/devices";
import { AttemptStatus, Device } from "@/logic/interfaces";
import { prettyAttemptStatus } from "@/logic/utils";

interface CreateAttemptModalProps {
    isOpen: boolean;
    onClose: () => void;
    roundId: string;
    competitorId?: string;
    timeLimit?: TimeLimit;
}

const CreateAttemptModal = ({
    isOpen,
    onClose,
    roundId,
    competitorId,
    timeLimit,
}: CreateAttemptModalProps) => {
    const toast = useToast();
    const [devices, setDevices] = useState<Device[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [selectedJudgeId, setSelectedJudgeId] = useState<string>("");
    const [selectedCompetitorId, setSelectedCompetitorId] = useState<string>(
        competitorId || ""
    );
    const [attemptStatus, setAttemptStatus] = useState<AttemptStatus>(
        AttemptStatus.STANDARD_ATTEMPT
    );
    const [submitToWcaLive, setSubmitToWcaLive] = useState<boolean>(false);
    const [value, setValue] = useState<number>(0);
    const [penalty, setPenalty] = useState<number>(0);
    const [deviceId, setDeviceId] = useState<string>("");

    useEffect(() => {
        if (!isOpen) return;
        getAllDevices().then((data) => {
            setDevices(
                data.filter((device: Device) => device.type === "STATION")
            );
            setDeviceId(data[0].id);
        });
    }, [isOpen]);

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        const formData = new FormData(e.currentTarget);
        const data = {
            roundId,
            status: attemptStatus,
            submitToWcaLive,
            competitorId: selectedCompetitorId,
            judgeId: selectedJudgeId,
            deviceId: deviceId,
            attemptNumber: formData.get("attemptNumber")
                ? parseInt(formData.get("attemptNumber") as string)
                : 0,
            value: value,
            penalty: penalty,
            comment: formData.get("comment") as string,
            replacedBy: formData.get("replacedBy")
                ? parseInt(formData.get("replacedBy") as string)
                : 0,
        };
        if (timeLimit) {
            if (data.value + data.penalty * 100 > timeLimit.centiseconds) {
                data.penalty = DNF_VALUE;
                toast({
                    title: "Time limit not passed, time was replaced to DNF",
                    status: "warning",
                    duration: 3000,
                    isClosable: true,
                });
            }
        }
        const status = await createAttempt(data);
        if (status === 201) {
            toast({
                title: "Attempt created",
                status: "success",
                duration: 3000,
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

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Enter attempt">
            <Box
                display="flex"
                flexDirection="column"
                gap="5"
                as="form"
                onSubmit={handleSubmit}
            >
                {!competitorId && (
                    <FormControl isRequired>
                        <FormLabel>Competitor</FormLabel>
                        <PersonAutocomplete
                            value={selectedCompetitorId}
                            disabled={isLoading}
                            onSelect={setSelectedCompetitorId}
                        />
                    </FormControl>
                )}
                <FormControl isRequired>
                    <FormLabel>Attempt status</FormLabel>
                    <Select
                        disabled={isLoading}
                        value={attemptStatus}
                        onChange={(e) =>
                            setAttemptStatus(e.target.value as AttemptStatus)
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
                <FormControl isRequired>
                    <FormLabel>Attempt number</FormLabel>
                    <Input
                        placeholder="Attempt number"
                        _placeholder={{ color: "white" }}
                        disabled={isLoading}
                        name="attemptNumber"
                    />
                </FormControl>
                {timeLimit && +value >= timeLimit.centiseconds && (
                    <Alert status="warning" color="black">
                        <AlertIcon />
                        Time limit not passed, time should be replaced to DNF
                    </Alert>
                )}
                <FormControl isRequired>
                    <FormLabel>Time</FormLabel>
                    <AttemptResultInput
                        value={value}
                        onChange={setValue}
                        disabled={isLoading}
                    />
                </FormControl>
                <PenaltySelect
                    value={penalty}
                    onChange={setPenalty}
                    disabled={isLoading}
                />
                <FormControl>
                    <FormLabel>Judge</FormLabel>
                    <PersonAutocomplete
                        onSelect={setSelectedJudgeId}
                        disabled={isLoading}
                        value={selectedJudgeId}
                    />
                </FormControl>
                <FormControl>
                    <FormLabel>Device</FormLabel>
                    <Select
                        disabled={isLoading}
                        value={deviceId}
                        onChange={(e) => setDeviceId(e.target.value)}
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
                        disabled={isLoading}
                        name="comment"
                    />
                </FormControl>
                {attemptStatus !== AttemptStatus.EXTRA_GIVEN && (
                    <Checkbox
                        isChecked={submitToWcaLive}
                        onChange={(e) => setSubmitToWcaLive(e.target.checked)}
                    >
                        Submit to WCA Live
                    </Checkbox>
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

export default CreateAttemptModal;
