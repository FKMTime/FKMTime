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
import { FormEvent, useEffect, useState } from "react";
import { MdKey, MdWifi } from "react-icons/md";

import { Modal } from "@/Components/Modal";
import PasswordInput from "@/Components/PasswordInput.tsx";
import {
    getCompetitionSettings,
    updateDevicesSettings,
} from "@/logic/competition";
import { Competition } from "@/logic/interfaces";

interface UpdateDevicesSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const UpdateDevicesSettingsModal = ({
    isOpen,
    onClose,
}: UpdateDevicesSettingsModalProps) => {
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
            wifiSsid: competition.wifiSsid,
            wifiPassword: competition.wifiPassword,
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
                    <FormLabel display="flex" gap="2" alignItems="center">
                        <MdWifi />
                        <Text>Wifi SSID</Text>
                    </FormLabel>
                    <Input
                        value={competition.wifiSsid}
                        onChange={(event) => {
                            setCompetition({
                                ...competition,
                                wifiSsid: event.target.value,
                            });
                        }}
                        autoComplete="off"
                    />
                </FormControl>
                <FormControl display="flex" flexDirection="column" gap="2">
                    <FormLabel display="flex" gap="2" alignItems="center">
                        <MdKey />
                        <Text>Wifi password</Text>
                    </FormLabel>
                    <PasswordInput
                        value={competition.wifiPassword}
                        autoComplete="off"
                        onChange={(event) => {
                            setCompetition({
                                ...competition,
                                wifiPassword: event.target.value,
                            });
                        }}
                    />
                </FormControl>
                <Button type="submit" colorScheme="green">
                    Save
                </Button>
            </Box>
        </Modal>
    );
};

export default UpdateDevicesSettingsModal;
