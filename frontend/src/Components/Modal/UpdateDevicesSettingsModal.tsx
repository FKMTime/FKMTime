import { Modal } from "./Modal.tsx";
import {
    Box,
    Button,
    Checkbox,
    FormControl,
    FormLabel,
    useToast,
} from "@chakra-ui/react";
import { FormEvent, useEffect, useState } from "react";
import { Competition, ReleaseChannel } from "../../logic/interfaces.ts";
import {
    getCompetitionSettings,
    updateDevicesSettings,
} from "../../logic/competition.ts";
import Select from "../../Components/Select.tsx";

interface UpdateDevicesSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const UpdateDevicesSettingsModal: React.FC<UpdateDevicesSettingsModalProps> = ({
    isOpen,
    onClose,
}) => {
    const toast = useToast();
    const [competition, setCompetition] = useState<Competition | null>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            const response = await getCompetitionSettings();
            if (response.status === 200) {
                setCompetition(response.data);
            }
        };
        fetchSettings();
    }, []);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!competition) return;
        const status = await updateDevicesSettings(competition.id, {
            shouldUpdateDevices: competition.shouldUpdateDevices,
            releaseChannel: competition.releaseChannel,
        });
        if (status === 200) {
            toast({
                title: "Successfully updated devices settings",
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
    };

    if (!competition) {
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Devices settings">
                <Box>Loading...</Box>
            </Modal>
        );
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Devices settings">
            <Box
                display="flex"
                flexDirection="column"
                gap="5"
                as="form"
                onSubmit={handleSubmit}
            >
                <FormControl display="flex" flexDirection="column" gap="2">
                    <Checkbox
                        defaultChecked={competition.shouldUpdateDevices}
                        onChange={(event) =>
                            setCompetition({
                                ...competition,
                                shouldUpdateDevices: event?.target.checked,
                            })
                        }
                    >
                        Update devices (turn it off if competition is in
                        progress)
                    </Checkbox>
                </FormControl>
                <FormControl display="flex" flexDirection="column" gap="2">
                    <FormLabel>Release channel</FormLabel>
                    <Select
                        value={competition.releaseChannel}
                        onChange={(event) => {
                            setCompetition({
                                ...competition,
                                releaseChannel: event?.target
                                    .value as ReleaseChannel,
                            });
                        }}
                    >
                        <option value="STABLE">Stable</option>
                        <option value="PRE_RELEASE">Pre-release</option>
                    </Select>
                </FormControl>
                <Button type="submit" colorScheme="green">
                    Save
                </Button>
            </Box>
        </Modal>
    );
};

export default UpdateDevicesSettingsModal;
