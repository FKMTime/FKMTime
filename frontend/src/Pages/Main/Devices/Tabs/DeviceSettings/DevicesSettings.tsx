import { useEffect, useState } from "react";

import LoadingPage from "@/Components/LoadingPage";
import { useToast } from "@/hooks/useToast";
import {
    getCompetitionSettings,
    updateDevicesSettings,
} from "@/lib/competition";
import { Competition } from "@/lib/interfaces";

import DeviceSettingsForm from "./DeviceSettingsForm";

const DevicesSettings = () => {
    const { toast } = useToast();
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

    const handleSubmit = async (data: Competition) => {
        if (!competition || !data) return;
        const status = await updateDevicesSettings(competition.id, {
            ...data,
        });
        if (status === 200) {
            toast({
                title: "Successfully updated devices settings",
                variant: "success",
            });
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
        }
    };

    if (!competition) return <LoadingPage />;

    return (
        <div className="rounded-mobile-card border bg-card p-4 md:rounded-2xl md:p-6">
            <DeviceSettingsForm
                competition={competition}
                handleSubmit={handleSubmit}
            />
        </div>
    );
};

export default DevicesSettings;
