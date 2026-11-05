import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { useState } from "react";

import LoadingPage from "@/Components/LoadingPage";
import RequestError from "@/Components/shared/RequestError";
import SwitchRow from "@/Components/shared/SwitchRow";
import { Button } from "@/Components/ui/button";
import { useToast } from "@/hooks/useToast";
import { Settings as SettingsInterface } from "@/lib/interfaces";
import { isDelegate } from "@/lib/permissions";
import { toQueryOptions } from "@/lib/queryCache";
import { useScanSoundSetting } from "@/lib/scanSound";
import { settingsQuery, updateSettings } from "@/lib/settings";

import ChangePasswordModal from "./Components/ChangePasswordModal";
import QuickActions from "./Components/QuickActions";
import SettingsForm from "./Components/SettingsForm";

const Settings = () => {
    const [isScanSoundOn, setIsScanSoundOn] = useScanSoundSetting();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const {
        data: settings,
        isError,
        refetch,
    } = useQuery(toQueryOptions(settingsQuery));
    const [isSaving, setIsSaving] = useState(false);
    const [isOpenChangePasswordModal, setIsOpenChangePasswordModal] =
        useState<boolean>(false);

    const handleSubmit = async (data: SettingsInterface) => {
        if (!settings) return;
        setIsSaving(true);
        const status = await updateSettings(data);
        if (status === 200) {
            queryClient.invalidateQueries({
                queryKey: toQueryOptions(settingsQuery).queryKey,
            });
            toast({ title: "Account saved", variant: "success" });
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
        }
        setIsSaving(false);
    };

    const retry = () => void refetch();

    if (!settings) {
        return isError ? <RequestError onRetry={retry} /> : <LoadingPage />;
    }

    return (
        <>
            {isError && <RequestError hasData onRetry={retry} />}
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
                        isLoading={isSaving}
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
