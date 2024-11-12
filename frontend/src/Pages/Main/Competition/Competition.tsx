import {
    Box,
    Heading,
    Tab,
    TabList,
    TabPanel,
    TabPanels,
    Tabs,
    Text,
} from "@chakra-ui/react";
import { useSetAtom } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import { competitionAtom } from "@/logic/atoms";
import {
    getCompetitionInfo,
    getCompetitionSettings,
} from "@/logic/competition";
import { Competition as CompetitionInterface } from "@/logic/interfaces";
import { getGitCommitValue } from "@/logic/utils";

import CompetitionStatistics from "../../../Components/CompetitionStatistics/CompetitionStatistics";
import ManageCompetition from "./Tabs/ManageCompetition";
import Rooms from "./Tabs/Rooms";
import UnofficialEvents from "./Tabs/UnofficialEvents/UnofficialEvents";

const tabs = [
    {
        id: "competitionSettings",
        name: "Manage competition",
        value: 0,
    },
    {
        id: "rooms",
        name: "Current groups",
        value: 1,
    },
    {
        id: "unofficialEvents",
        name: "Unofficial events",
        value: 2,
    },
    {
        id: "statistics",
        name: "Statistics",
        value: 3,
    },
];

const Competition = () => {
    const navigate = useNavigate();
    const setCompetitionAtom = useSetAtom(competitionAtom);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [competition, setCompetition] = useState<CompetitionInterface | null>(
        null
    );
    const [tabIndex, setTabIndex] = useState<number>(tabs[0].value);
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

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (isLoading || !competition) {
        return <LoadingPage />;
    }

    return (
        <Box display="flex" flexDirection="column" gap="5">
            <Heading size="lg">{competition?.name}</Heading>
            <Text>Version: {getGitCommitValue()}</Text>
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
                    <TabPanel>
                        <ManageCompetition
                            competition={competition}
                            setCompetition={setCompetition}
                            fetchCompetitionDataAndSetAtom={
                                fetchCompetitionDataAndSetAtom
                            }
                        />
                    </TabPanel>
                    <TabPanel ml={-4}>
                        <Rooms />
                    </TabPanel>
                    <TabPanel ml={-4}>
                        <UnofficialEvents />
                    </TabPanel>
                    <TabPanel ml={-4}>
                        <CompetitionStatistics enableMobile showCharts />
                    </TabPanel>
                </TabPanels>
            </Tabs>
        </Box>
    );
};

export default Competition;
