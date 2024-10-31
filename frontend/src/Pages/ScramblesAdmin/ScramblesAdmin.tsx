import { Box, Tab, TabList, TabPanel, TabPanels, Tabs } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import ImportScrambles from "./Tabs/ImportScrambles/ImportScrambles";
import ScramblingDevices from "./Tabs/ScramblingDevices/ScramblingDevices";

const tabs = [
    {
        id: "scramblingDevices",
        name: "Scrambling devices",
        value: 0,
        component: <ScramblingDevices />,
    },
    {
        id: "importScrambles",
        name: "Import scrambles",
        value: 1,
        component: <ImportScrambles />,
    },
    {
        id: "scrambleSets",
        name: "Scramble sets",
        value: 2,
        component: <Box>Scramble sets</Box>,
    },
];
const ScramblesAdmin = () => {
    const [tabIndex, setTabIndex] = useState<number>(tabs[0].value);
    const [searchParams, setSearchParams] = useSearchParams();

    const onChangeTabIndex = (index: number) => {
        setTabIndex(index);
        const tab = tabs.find((t) => t.value === index)?.id;
        if (!tab) return;
        setSearchParams({ tab: tab });
    };

    useEffect(() => {
        const tab = searchParams.get("tab");
        const index = tabs.find((t) => t.id === tab)?.value;
        if (index) {
            setTabIndex(index);
        }
    }, [searchParams]);

    return (
        <Box display="flex" flexDirection="column" gap="5">
            <Tabs
                variant="enclosed"
                index={tabIndex}
                onChange={onChangeTabIndex}
                isFitted
            >
                <TabList>
                    {tabs.map((tab) => (
                        <Tab
                            key={tab.id}
                            _selected={{
                                color: "white",
                                bg: "blue.500",
                            }}
                        >
                            {tab.name}
                        </Tab>
                    ))}
                </TabList>
                <TabPanels>
                    {tabs.map((tab) => (
                        <TabPanel key={tab.id} ml={-4}>
                            {tab.component}
                        </TabPanel>
                    ))}
                </TabPanels>
            </Tabs>
        </Box>
    );
};

export default ScramblesAdmin;
