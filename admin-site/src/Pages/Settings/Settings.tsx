import {
    Box,
    Button,
    FormControl,
    FormLabel,
    Heading,
    Input,
    useToast,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { Settings as SettingsInterface } from "../../logic/interfaces";
import LoadingPage from "../../Components/LoadingPage";
import { getSettings, updateSettings } from "../../logic/settings";
import ChangePasswordModal from "../../Components/Modal/ChangePasswordModal";

const Settings = (): JSX.Element => {
    const toast = useToast();
    const [settings, setSettings] = useState<SettingsInterface | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isOpenChangePasswordModal, setIsOpenChangePasswordModal] =
        useState<boolean>(false);

    const fetchData = async () => {
        setIsLoading(true);
        const data = await getSettings();
        setSettings(data);
        setIsLoading(false);
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!settings) return;
        setIsLoading(true);
        const status = await updateSettings(settings);
        if (status === 200) {
            toast({
                title: "Successfully updated settings.",
                status: "success",
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

    useEffect(() => {
        fetchData();
    }, []);

    if (!settings) return <LoadingPage />;

    return (
        <>
            <Heading fontSize="3xl">Settings</Heading>
            <Box
                display="flex"
                flexDirection="column"
                gap={3}
                as="form"
                width="20%"
                mt={5}
                onSubmit={handleSubmit}
            >
                <FormControl isRequired>
                    <FormLabel>Username</FormLabel>
                    <Input
                        placeholder="Username"
                        _placeholder={{ color: "white" }}
                        value={settings.username}
                        disabled={isLoading}
                        onChange={(e) =>
                            setSettings({
                                ...settings,
                                username: e.target.value,
                            })
                        }
                    />
                </FormControl>
                <FormControl isRequired>
                    <FormLabel>Email</FormLabel>
                    <Input
                        placeholder="Email"
                        _placeholder={{ color: "white" }}
                        value={settings.email}
                        disabled={isLoading}
                        onChange={(e) =>
                            setSettings({ ...settings, email: e.target.value })
                        }
                    />
                </FormControl>
                <Button colorScheme="green" isLoading={isLoading} type="submit">
                    Save
                </Button>
                <Button
                    colorScheme="yellow"
                    onClick={() => setIsOpenChangePasswordModal(true)}
                >
                    Change password
                </Button>
            </Box>
            <ChangePasswordModal
                isOpen={isOpenChangePasswordModal}
                onClose={() => setIsOpenChangePasswordModal(false)}
            />
        </>
    );
};

export default Settings;
