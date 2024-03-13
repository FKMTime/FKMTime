import { Modal } from "./Modal.tsx";
import {
    Box,
    Button,
    Checkbox,
    FormControl,
    FormLabel,
    Input,
    Select,
    useToast,
} from "@chakra-ui/react";
import { Device, Person } from "../../logic/interfaces.ts";
import { useEffect, useState } from "react";
import { getAllPersons } from "../../logic/persons.ts";
import { createAttempt } from "../../logic/attempt.ts";
import { getAllDevices } from "../../logic/devices.ts";
import { TimeLimit } from "@wca/helpers";

interface CreateAttemptModalModalProps {
    isOpen: boolean;
    onClose: () => void;
    roundId: string;
    competitorId?: string;
    timeLimit?: TimeLimit;
}

const CreateAttemptModal: React.FC<CreateAttemptModalModalProps> = ({
    isOpen,
    onClose,
    roundId,
    competitorId,
    timeLimit,
}) => {
    const toast = useToast();
    const [persons, setPersons] = useState<Person[]>([]);
    const [devices, setDevices] = useState<Device[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [selectedJudgeId, setSelectedJudgeId] = useState<string>("");
    const [selectedCompetitorId, setSelectedCompetitorId] = useState<string>(
        competitorId || ""
    );
    const [isDelegate, setIsDelegate] = useState<boolean>(false);
    const [extraGiven, setExtraGiven] = useState<boolean>(false);
    const [isResolved, setIsResolved] = useState<boolean>(false);
    const [submitToWcaLive, setSubmitToWcaLive] = useState<boolean>(false);
    const [isExtraAttempt, setIsExtraAttempt] = useState<boolean>(false);

    useEffect(() => {
        getAllPersons().then((data) => {
            setPersons(data);
        });
        getAllDevices().then((data) => {
            setDevices(
                data.filter((device: Device) => device.type === "STATION")
            );
        });
    }, []);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        const formData = new FormData(e.currentTarget);
        const data = {
            roundId,
            isDelegate,
            extraGiven,
            isExtraAttempt,
            isResolved,
            submitToWcaLive,
            competitorId: selectedCompetitorId,
            judgeId: selectedJudgeId,
            deviceId: formData.get("deviceId") as string,
            attemptNumber: formData.get("attemptNumber")
                ? parseInt(formData.get("attemptNumber") as string)
                : 0,
            value: formData.get("value")
                ? parseInt(formData.get("value") as string)
                : 0,
            penalty: formData.get("penalty")
                ? parseInt(formData.get("penalty") as string)
                : 0,
            comment: formData.get("comment") as string,
            replacedBy: formData.get("replacedBy")
                ? parseInt(formData.get("replacedBy") as string)
                : 0,
        };
        if (timeLimit) {
            if (data.value + data.penalty * 100 > timeLimit.centiseconds) {
                data.penalty = -1;
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
        <Modal isOpen={isOpen} onClose={onClose} title="Create account">
            <Box
                display="flex"
                flexDirection="column"
                gap="5"
                as="form"
                onSubmit={handleSubmit}
            >
                <FormControl isRequired>
                    <FormLabel>Competitor</FormLabel>
                    <Select
                        placeholder="Select competitor"
                        _placeholder={{ color: "white" }}
                        value={selectedCompetitorId}
                        disabled={isLoading || competitorId !== undefined}
                        onChange={(e) =>
                            setSelectedCompetitorId(e.target.value)
                        }
                    >
                        {persons
                            .filter((p) => p.canCompete)
                            .map((person) => (
                                <option key={person.id} value={person.id}>
                                    {person.name} ({person.registrantId})
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
                <Checkbox
                    isChecked={isExtraAttempt}
                    onChange={(e) => setIsExtraAttempt(e.target.checked)}
                >
                    Is extra attempt
                </Checkbox>
                <FormControl isRequired>
                    <FormLabel>Time</FormLabel>
                    <Input
                        placeholder="Time"
                        _placeholder={{ color: "white" }}
                        disabled={isLoading}
                        name="value"
                    />
                </FormControl>
                <FormControl>
                    <FormLabel>Penalty</FormLabel>
                    <Select
                        placeholder="Select penalty"
                        _placeholder={{ color: "white" }}
                        disabled={isLoading}
                        name="penalty"
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
                <FormControl>
                    <FormLabel>Judge</FormLabel>
                    <Select
                        placeholder="Select judge"
                        _placeholder={{ color: "white" }}
                        value={selectedJudgeId}
                        disabled={isLoading}
                        onChange={(e) => setSelectedJudgeId(e.target.value)}
                    >
                        {persons.map((person) => (
                            <option key={person.id} value={person.id}>
                                {person.name} ({person.registrantId})
                            </option>
                        ))}
                    </Select>
                </FormControl>
                <FormControl>
                    <FormLabel>Device</FormLabel>
                    <Select
                        placeholder="Select device"
                        _placeholder={{ color: "white" }}
                        disabled={isLoading}
                        name="deviceId"
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
                {extraGiven && (
                    <FormControl>
                        <FormLabel>Replaced by</FormLabel>
                        <Input
                            placeholder="Replaced by"
                            _placeholder={{ color: "white" }}
                            disabled={isLoading}
                            name="replacedBy"
                        />
                    </FormControl>
                )}
                <Checkbox
                    isChecked={isDelegate}
                    onChange={(e) => setIsDelegate(e.target.checked)}
                >
                    Is delegate case
                </Checkbox>
                {isDelegate && (
                    <>
                        <Checkbox
                            isChecked={isResolved}
                            onChange={(e) => setIsResolved(e.target.checked)}
                        >
                            Is resolved
                        </Checkbox>
                        <Checkbox
                            isChecked={extraGiven}
                            onChange={(e) => setExtraGiven(e.target.checked)}
                        >
                            Extra given
                        </Checkbox>
                    </>
                )}
                <Checkbox
                    isChecked={submitToWcaLive}
                    onChange={(e) => setSubmitToWcaLive(e.target.checked)}
                >
                    Submit to WCA Live
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

export default CreateAttemptModal;
