/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";

import LoadingPage from "@/Components/LoadingPage";
import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { useToast } from "@/hooks/useToast";
import { Settings as SettingsInterface } from "@/lib/interfaces";
import { isDelegate } from "@/lib/permissions";
import { getSettings, updateSettings } from "@/lib/settings";
import PageTransition from "@/Pages/PageTransition";

import ChangePasswordModal from "./Components/ChangePasswordModal";
import QuickActions from "./Components/QuickActions";
import SettingsForm from "./Components/SettingsForm";

const Settings = () => {
    const { toast } = useToast();
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

    const handleSubmit = async (data: SettingsInterface) => {
        if (!settings) return;
        setIsLoading(true);
        const status = await updateSettings(data);
        if (status === 200) {
            toast({
                title: "Successfully updated settings.",
                variant: "success",
            });
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (!settings) return <LoadingPage />;

    return (
        <PageTransition>
            <div className="flex flex-col gap-4">
                {!settings.wcaUserId ? (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex justify-between items-center">
                                Settings
                                <Button
                                    onClick={() =>
                                        setIsOpenChangePasswordModal(true)
                                    }
                                >
                                    Change password
                                </Button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <SettingsForm
                                settings={settings}
                                handleSubmit={handleSubmit}
                                isLoading={isLoading}
                            />
                        </CardContent>
                    </Card>
                ) : null}
                {isDelegate() && <QuickActions />}
                <ChangePasswordModal
                    isOpen={isOpenChangePasswordModal}
                    onClose={() => setIsOpenChangePasswordModal(false)}
                />
            </div>
        </PageTransition>
    );
};

export default Settings;
