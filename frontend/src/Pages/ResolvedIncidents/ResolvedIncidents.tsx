import { Flex, Heading, Input } from "@chakra-ui/react";
import { useAtom } from "jotai";
import { useCallback, useEffect, useState } from "react";

import LoadingPage from "@/Components/LoadingPage.tsx";
import { competitionAtom } from "@/logic/atoms";
import { getResolvedIncidents } from "@/logic/attempt";
import { getCompetitionInfo } from "@/logic/competition";
import { Incident } from "@/logic/interfaces";
import ResolvedIncidentsTable from "@/Pages/ResolvedIncidents/Components/ResolvedIncidentsTable";

const ResolvedIncidents = () => {
    const [competition, setCompetition] = useAtom(competitionAtom);
    const [search, setSearch] = useState<string>("");
    const [incidents, setIncidents] = useState<Incident[]>([]);

    const fetchCompetitionData = useCallback(async () => {
        if (!competition) {
            const competitionData = await getCompetitionInfo();
            setCompetition(competitionData.data);
        }
    }, [competition, setCompetition]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        fetchData(e.target.value);
    };

    const fetchData = useCallback(async (searchParam?: string) => {
        const data = await getResolvedIncidents(searchParam);
        setIncidents(data);
    }, []);

    useEffect(() => {
        fetchData(search);
        fetchCompetitionData();
    }, [fetchCompetitionData, fetchData, search]);

    if (!competition) {
        return <LoadingPage />;
    }

    return (
        <Flex flexDirection="column" gap="5">
            <Heading size="lg">Resolved incidents</Heading>
            <Input
                placeholder="Search"
                _placeholder={{ color: "white" }}
                value={search}
                onChange={handleSearch}
                width="100%"
            />
            {incidents.length > 0 ? (
                <ResolvedIncidentsTable
                    data={incidents}
                    wcif={competition.wcif}
                />
            ) : (
                <Heading size="md">No resolved incidents found</Heading>
            )}
        </Flex>
    );
};

export default ResolvedIncidents;
