import {
    Box,
    Button,
    Flex,
    FormControl,
    FormLabel,
    Heading,
    Input,
    useToast,
} from "@chakra-ui/react";
import { FormEvent, useEffect, useState } from "react";

import LoadingPage from "@/Components/LoadingPage";
import { isAdmin } from "@/logic/auth.ts";
import { Settings as SettingsInterface } from "@/logic/interfaces";
import { getSettings, updateSettings } from "@/logic/settings";
import QuickActions from "@/Pages/Main/Settings/Components/QuickActions";

import ChangePasswordModal from "./Components/ChangePasswordModal";

const Settings = () => {
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

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!settings) return;
        setIsLoading(true);
        const status = await updateSettings(settings);
        if (status === 200) {
            toast({
                title: "Successfully updated settings.",
                status: "success",
            });
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
        fetchData();
    }, []);

    if (!settings) return <LoadingPage />;

    return (
        <Flex flexDirection="column" gap="5">
            {!settings.wcaUserId && (
                <Box>
                    <Heading fontSize="3xl">Settings</Heading>
                    <Box
                        display="flex"
                        flexDirection="column"
                        gap={3}
                        as="form"
                        width={{ base: "100%", md: "20%" }}
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
                        <Button
                            colorPalette="green"
                            isLoading={isLoading}
                            type="submit"
                        >
                            Save
                        </Button>
                        <Button
                            colorPalette="yellow"
                            onClick={() => setIsOpenChangePasswordModal(true)}
                        >
                            Change password
                        </Button>
                    </Box>
                </Box>
            )}
            {isAdmin() && <QuickActions />}
            <ChangePasswordModal
                isOpen={isOpenChangePasswordModal}
                onClose={() => setIsOpenChangePasswordModal(false)}
            />
        </Flex>
    );
};

export default Settings;
