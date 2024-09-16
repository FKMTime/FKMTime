import {
    Box,
    Heading,
    Tab,
    TabList,
    TabPanel,
    TabPanels,
    Tabs,
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

import CompetitionStatistics from "../../Components/CompetitionStatistics";
import UnofficialEvents from "../UnofficialEvents/UnofficialEvents";
import ManageCompetition from "./Tabs/ManageCompetition";
import Rooms from "./Tabs/Rooms";

const tabs = [
    {
        name: "competitionSettings",
        value: 0,
    },
    {
        name: "rooms",
        value: 1,
    },
    {
        name: "unofficialEvents",
        value: 2,
    },
    {
        name: "statistics",
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
        const tab = tabs.find((t) => t.value === index)?.name;
        if (!tab) return;
        setSearchParams({ tab: tab });
    };

    useEffect(() => {
        const tab = searchParams.get("tab");
        const index = tabs.find((t) => t.name === tab)?.value;
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
            <Tabs
                variant="enclosed"
                index={tabIndex}
                onChange={onChangeTabIndex}
                isFitted
            >
                <TabList>
                    <Tab
                        _selected={{
                            color: "white",
                            bg: "blue.500",
                        }}
                    >
                        Manage competition
                    </Tab>
                    <Tab _selected={{ color: "white", bg: "blue.500" }}>
                        Current groups
                    </Tab>
                    <Tab
                        _selected={{
                            color: "white",
                            bg: "blue.500",
                        }}
                    >
                        Unofficial events
                    </Tab>
                    <Tab _selected={{ color: "white", bg: "blue.500" }}>
                        Statistics
                    </Tab>
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
                        <CompetitionStatistics enableMobile />
                    </TabPanel>
                </TabPanels>
            </Tabs>
        </Box>
    );
};

export default Competition;
