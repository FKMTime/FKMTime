import { KeyRound } from "lucide-react";
import { useEffect, useState } from "react";

import LoadingPage from "@/Components/LoadingPage";
import SwitchRow from "@/Components/shared/SwitchRow";
import { Button } from "@/Components/ui/button";
import { useToast } from "@/hooks/useToast";
import { Settings as SettingsInterface } from "@/lib/interfaces";
import { isDelegate } from "@/lib/permissions";
import { useScanSoundSetting } from "@/lib/scanSound";
import { getSettings, updateSettings } from "@/lib/settings";

import ChangePasswordModal from "./Components/ChangePasswordModal";
import QuickActions from "./Components/QuickActions";
import SettingsForm from "./Components/SettingsForm";

const Settings = () => {
    const [isScanSoundOn, setIsScanSoundOn] = useScanSoundSetting();
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
            toast({ title: "Account saved", variant: "success" });
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
        <>
            <section
                aria-labelledby="this-device"
                className="flex max-w-[560px] flex-col gap-2 rounded-mobile-card border bg-card p-4 md:rounded-2xl md:p-[22px]"
            >
                <h2 id="this-device" className="text-base font-bold">
                    This device
                </h2>
                <SwitchRow
                    label="Scan sounds"
                    description="A short beep for each card scan at check-in and card assignment: high for success, low for a problem. Saved on this device only."
                    checked={isScanSoundOn}
                    onCheckedChange={setIsScanSoundOn}
                />
            </section>
            {!settings.wcaUserId && (
                <section
                    aria-labelledby="account"
                    className="flex max-w-[560px] flex-col gap-4 rounded-mobile-card border bg-card p-4 md:gap-[18px] md:rounded-2xl md:p-[22px]"
                >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 id="account" className="text-base font-bold">
                            Account
                        </h2>
                        <Button
                            variant="outline"
                            size="sm"
                            className="max-md:hidden"
                            onClick={() => setIsOpenChangePasswordModal(true)}
                        >
                            <KeyRound />
                            Change password
                        </Button>
                    </div>
                    <SettingsForm
                        settings={settings}
                        handleSubmit={handleSubmit}
                        isLoading={isLoading}
                    />
                    <Button
                        variant="outline"
                        size="lg"
                        className="md:hidden"
                        onClick={() => setIsOpenChangePasswordModal(true)}
                    >
                        <KeyRound />
                        Change password
                    </Button>
                </section>
            )}
            {isDelegate() && <QuickActions />}
            <ChangePasswordModal
                isOpen={isOpenChangePasswordModal}
                onClose={() => setIsOpenChangePasswordModal(false)}
            />
        </>
    );
};

export default Settings;
