import LoadingPage from "@/Components/LoadingPage";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useToast } from "@/hooks/useToast";
import {
    competitionSettingsQuery,
    updateDevicesSettings,
} from "@/lib/competition";
import { Competition } from "@/lib/interfaces";

import DeviceSettingsForm from "./DeviceSettingsForm";

const DevicesSettings = () => {
    const { toast } = useToast();
    const {
        data: competition,
        version,
        refetch,
    } = useLiveQuery(competitionSettingsQuery);

    const handleSubmit = async (values: Competition) => {
        if (!competition || !values) return;
        const status = await updateDevicesSettings(competition.id, values);
        if (status === 200) {
            void refetch();
            toast({ title: "Device settings saved", variant: "success" });
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
                // Fresh settings from the server re-seed the form
                key={version}
                competition={competition}
                handleSubmit={handleSubmit}
            />
        </div>
    );
};

export default DevicesSettings;
