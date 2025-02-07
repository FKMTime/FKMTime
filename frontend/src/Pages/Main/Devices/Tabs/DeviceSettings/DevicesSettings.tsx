import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { useToast } from "@/hooks/useToast";
import {
    getCompetitionSettings,
    updateDevicesSettings,
} from "@/lib/competition";
import { Competition } from "@/lib/interfaces";
import PageTransition from "@/Pages/PageTransition";

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

    if (!competition) {
        return <div>Loading...</div>;
    }

    return (
        <PageTransition>
            <Card>
                <CardHeader>
                    <CardTitle>Settings</CardTitle>
                </CardHeader>
                <CardContent>
                    <DeviceSettingsForm
                        competition={competition}
                        handleSubmit={handleSubmit}
                    />
                </CardContent>
            </Card>
        </PageTransition>
    );
};

export default DevicesSettings;
