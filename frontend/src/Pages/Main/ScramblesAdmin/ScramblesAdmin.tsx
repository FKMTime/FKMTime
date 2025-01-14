import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/Components/ui/tabs";

import ImportScrambles from "./Tabs/ImportScrambles/ImportScrambles";
import ScrambleSets from "./Tabs/ScrambleSets/ScrambleSets";
import ScramblingDevices from "./Tabs/ScramblingDevices/ScramblingDevices";

const tabs = [
    {
        id: "scramblingDevices",
        name: "Scrambling devices",
        component: <ScramblingDevices />,
    },
    // {
    //     id: "importScrambles",
    //     name: "Import scrambles",
    //     component: <ImportScrambles />,
    // },
    // {
    //     id: "scrambleSets",
    //     name: "Scramble sets",
    //     component: <ScrambleSets />,
    // },
];
const ScramblesAdmin = () => {
    const [tabIndex, setTabIndex] = useState<string>(tabs[0].id);
    const [searchParams, setSearchParams] = useSearchParams();

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

    return (
        <div className="flex flex-col gap-4">
            <Tabs defaultValue={tabIndex}>
                <Card>
                    <CardHeader>
                        <CardTitle>Scrambles admin</CardTitle>
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
                {tabs.map((tab) => (
                    <TabsContent key={tab.id} value={tab.id}>
                        {tab.component}
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    );
};

export default ScramblesAdmin;
