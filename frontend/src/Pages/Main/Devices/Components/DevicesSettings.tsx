import {
    Box,
    Button,
    Checkbox,
    FormControl,
    FormHelperText,
    FormLabel,
    Heading,
    Input,
    Text,
    useToast,
} from "@chakra-ui/react";
import { FormEvent, useEffect, useState } from "react";
import { MdKey, MdWifi } from "react-icons/md";

import PasswordInput from "@/Components/PasswordInput.tsx";
import {
    getCompetitionSettings,
    updateDevicesSettings,
} from "@/logic/competition";
import { Competition } from "@/logic/interfaces";

const DevicesSettings = () => {
    const toast = useToast();
    const [competition, setCompetition] = useState<Competition | null>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            const response = await getCompetitionSettings();
            if (response.status === 200) {
                setCompetition({
                    ...response.data,
                    wcif: undefined,
                });
            }
        };
        fetchSettings();
    }, []);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!competition) return;
        const status = await updateDevicesSettings(competition.id, {
            ...competition,
        });
        if (status === 200) {
            toast({
                title: "Successfully updated devices settings",
                status: "success",
            });
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                status: "error",
            });
        }
    };

    if (!competition) {
        return <Box>Loading...</Box>;
    }

    return (
        <Box
            display="flex"
            flexDirection="column"
            gap="5"
            as="form"
            onSubmit={handleSubmit}
        >
            <Heading size="lg">Settings</Heading>
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
                    Update devices (turn it off if competition is in progress)
                </Checkbox>
            </FormControl>
            <FormControl display="flex" flexDirection="column" gap="2">
                <Checkbox
                    defaultChecked={competition.mdns}
                    onChange={(event) =>
                        setCompetition({
                            ...competition,
                            mdns: event?.target.checked,
                        })
                    }
                >
                    Auto server discovery
                </Checkbox>
                <FormHelperText color="gray.300">
                    Use MDNS to search for a server in local network
                </FormHelperText>
            </FormControl>
            {!competition.mdns && (
                <>
                    <FormControl>
                        <FormLabel>Server IP</FormLabel>
                        <Input
                            value={competition.ipAddress}
                            placeholder="192.168.1.100"
                            _placeholder={{ color: "white" }}
                            onChange={(event) => {
                                setCompetition({
                                    ...competition,
                                    ipAddress: event.target.value,
                                });
                            }}
                            autoComplete="off"
                        />
                    </FormControl>
                    <FormControl>
                        <FormLabel>Server port</FormLabel>
                        <Input
                            value={competition.port}
                            placeholder="8080"
                            _placeholder={{ color: "white" }}
                            onChange={(event) => {
                                setCompetition({
                                    ...competition,
                                    port: +event.target.value,
                                });
                            }}
                            autoComplete="off"
                        />
                    </FormControl>
                    <FormControl>
                        <Checkbox
                            defaultChecked={competition.secure}
                            onChange={(event) =>
                                setCompetition({
                                    ...competition,
                                    secure: event?.target.checked,
                                })
                            }
                        >
                            Use SSL
                        </Checkbox>
                    </FormControl>
                </>
            )}
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
    );
};

export default DevicesSettings;
