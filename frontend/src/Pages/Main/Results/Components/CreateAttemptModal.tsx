import {
    Alert,
    AlertIcon,
    Box,
    Button,
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
import { DNF_VALUE, DNS_VALUE } from "@/logic/constants";
import { getAllDevices } from "@/logic/devices";
import {
    AttemptStatus,
    AttemptType,
    Device,
    DeviceType,
    Person,
} from "@/logic/interfaces";
import {
    getSubmissionPlatformName,
    prettyAttemptStatus,
    prettyAttemptType,
} from "@/logic/utils";

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
    const [selectedJudge, setSelectedJudge] = useState<Person | null>(null);
    const [selectedScrambler, setSelectedScrambler] = useState<Person | null>(
        null
    );
    const [selectedCompetitor, setSelectedCompetitor] = useState<Person | null>(
        null
    );
    const [attemptStatus, setAttemptStatus] = useState<AttemptStatus>(
        AttemptStatus.STANDARD
    );
    const [attemptType, setAttemptType] = useState<AttemptType>(
        AttemptType.STANDARD_ATTEMPT
    );
    const [value, setValue] = useState<number>(0);
    const [penalty, setPenalty] = useState<number>(0);
    const [deviceId, setDeviceId] = useState<string>("");

    const submissionPlatform = getSubmissionPlatformName(roundId.split("-")[0]);
    const isTimeRequired =
        attemptStatus !== AttemptStatus.EXTRA_GIVEN &&
        penalty !== DNF_VALUE &&
        penalty !== DNS_VALUE;

    useEffect(() => {
        if (isOpen) {
            getAllDevices(DeviceType.STATION).then((data) => {
                setDevices(data);
                if (data.length > 0) {
                    setDeviceId(data[0].id);
                }
            });
        }
    }, [isOpen]);

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const selectedCompetitorId = competitorId
            ? competitorId
            : selectedCompetitor?.id;
        if (!selectedCompetitorId) {
            return toast({
                title: "Competitor is required",
                status: "error",
            });
        }
        if (selectedJudge && selectedCompetitorId === selectedJudge.id) {
            return toast({
                title: "Judge cannot be the same as competitor",
                status: "error",
            });
        }
        if (
            selectedScrambler &&
            selectedCompetitorId === selectedScrambler.id
        ) {
            return toast({
                title: "Scrambler cannot be the same as competitor",
                status: "error",
            });
        }
        setIsLoading(true);
        const formData = new FormData(e.currentTarget);
        const data = {
            roundId,
            status: attemptStatus,
            competitorId: selectedCompetitorId,
            judgeId: selectedJudge ? selectedJudge.id : undefined,
            scramblerId: selectedScrambler ? selectedScrambler.id : undefined,
            deviceId: deviceId,
            type: attemptType,
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
                });
            }
        }
        const status = await createAttempt(data);
        if (status === 201) {
            toast({
                title: `Attempt created and submitted to ${submissionPlatform}`,
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
                            value={selectedCompetitor}
                            disabled={isLoading}
                            onSelect={setSelectedCompetitor}
                        />
                    </FormControl>
                )}
                <FormControl isRequired>
                    <FormLabel>Attempt type</FormLabel>
                    <Select
                        disabled={isLoading}
                        value={attemptType}
                        onChange={(e) =>
                            setAttemptType(e.target.value as AttemptType)
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
                <FormControl isRequired={isTimeRequired}>
                    <FormLabel>Time</FormLabel>
                    <AttemptResultInput
                        value={value}
                        onChange={setValue}
                        disabled={isLoading}
                        required={isTimeRequired}
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
                        onSelect={setSelectedJudge}
                        disabled={isLoading}
                        value={selectedJudge}
                    />
                </FormControl>
                <FormControl>
                    <FormLabel>Scrambler</FormLabel>
                    <PersonAutocomplete
                        onSelect={setSelectedScrambler}
                        disabled={isLoading}
                        value={selectedScrambler}
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
