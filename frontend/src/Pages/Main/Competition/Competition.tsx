import { useSetAtom } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import CompetitionStatistics from "@/Components/CompetitionStatistics/CompetitionStatistics";
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

import ManageCompetition from "./Tabs/ManageCompetition";
import Rooms from "./Tabs/Rooms";
import UnofficialEvents from "./Tabs/UnofficialEvents/UnofficialEvents";

const tabs = [
    {
        id: "competitionSettings",
        name: "Manage competition",
    },
    {
        id: "rooms",
        name: "Current groups",
    },
    {
        id: "unofficialEvents",
        name: "Unofficial events",
    },
    {
        id: "statistics",
        name: "Statistics",
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
            });
            await fetchCompetitionDataAndSetAtom();
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
        <Tabs defaultValue={tabIndex}>
            <Card>
                <CardHeader className="flex flex-row justify-between items-center">
                    <div className="flex flex-col gap-2">
                        <CardTitle>{competition.name}</CardTitle>
                        <CardDescription>
                            Version: {getGitCommitValue()}
                        </CardDescription>
                    </div>
                    <div>
                        <Button
                            variant="success"
                            onClick={handleSync}
                            className="w-full"
                        >
                            Sync
                        </Button>
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
            <TabsContent value={tabs[2].id}>
                <UnofficialEvents />
            </TabsContent>
            <TabsContent value={tabs[3].id}>
                <CompetitionStatistics enableMobile showCharts />
            </TabsContent>
        </Tabs>
    );
};

export default Competition;
