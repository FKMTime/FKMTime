import { useSetAtom } from "jotai";
import { RefreshCw, Server } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import { Button } from "@/Components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/Components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/Components/ui/tabs";
import { useToast } from "@/hooks/useToast";
import { competitionAtom } from "@/lib/atoms";
import {
    getCompetitionInfo,
    getCompetitionSettings,
    syncCompetition,
} from "@/lib/competition";
import { Competition as CompetitionInterface } from "@/lib/interfaces";
import { getGitCommitValue } from "@/lib/utils";
import PageTransition from "@/Pages/PageTransition";

import ManageCompetition from "./Tabs/ManageCompetition/ManageCompetition";
import Rooms from "./Tabs/Rooms/Rooms";

const tabs = [
    {
        id: "competitionSettings",
        name: "Manage competition",
    },
    {
        id: "rooms",
        name: "Current groups",
    },
];

const Competition = () => {
    const { toast } = useToast();
    const navigate = useNavigate();
    const setCompetitionAtom = useSetAtom(competitionAtom);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [competition, setCompetition] = useState<CompetitionInterface | null>(
        null
    );
    const [tabIndex, setTabIndex] = useState<string>(tabs[0].id);
    const [searchParams, setSearchParams] = useSearchParams();

    const fetchData = useCallback(async () => {
        const response = await getCompetitionSettings();
        if (response.status === 200) {
            setCompetition(response.data);
        } else if (response.status === 404) {
            navigate("/competition/import");
        }
        setIsLoading(false);
    }, [navigate]);

    const fetchCompetitionDataAndSetAtom = async () => {
        const response = await getCompetitionInfo();
        setCompetitionAtom(response.data);
    };

    const handleSync = async () => {
        if (!competition || !competition.wcaId) {
            return;
        }
        const status = await syncCompetition(competition.wcaId);
        if (status === 200) {
            toast({
                title: "Success",
                description: "Competition synced",
                variant: "success",
            });
            await fetchCompetitionDataAndSetAtom();
        } else if (status === 403) {
            toast({
                title: "Error",
                description:
                    "You don't have permission to sync this competition",
                variant: "destructive",
            });
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
        }
    };

    const onChangeTab = (id: string) => {
        setTabIndex(id);
        const tab = tabs.find((t) => t.id === id)?.id;
        if (!tab) return;
        setSearchParams({ tab: tab });
    };

    useEffect(() => {
        const tab = searchParams.get("tab");
        const index = tabs.find((t) => t.id === tab)?.id;
        if (index) {
            setTabIndex(index);
        }
    }, [searchParams]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (isLoading || !competition) {
        return <LoadingPage />;
    }

    return (
        <PageTransition>
            <Tabs defaultValue={tabIndex}>
                <Card>
                    <CardHeader className="flex flex-row justify-between items-center">
                        <div className="flex flex-col gap-2">
                            <CardTitle>{competition.name}</CardTitle>
                            <CardDescription>
                                Version: {getGitCommitValue()}
                            </CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="success"
                                onClick={handleSync}
                                className="w-full"
                            >
                                <RefreshCw />
                                Sync
                            </Button>
                            {import.meta.env.PROD && (
                                <Button onClick={() => window.open("/logs")}>
                                    <Server />
                                    Logs
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <TabsList>
                            {tabs.map((tab) => (
                                <TabsTrigger
                                    key={tab.id}
                                    value={tab.id}
                                    onClick={() => onChangeTab(tab.id)}
                                >
                                    {tab.name}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </CardContent>
                </Card>
                <TabsContent value={tabs[0].id}>
                    <ManageCompetition
                        competition={competition}
                        setCompetition={setCompetition}
                    />
                </TabsContent>
                <TabsContent value={tabs[1].id}>
                    <Rooms />
                </TabsContent>
            </Tabs>
        </PageTransition>
    );
};

export default Competition;
