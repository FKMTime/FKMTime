import { Flex, Heading, Input } from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";

import { getResolvedIncidents } from "@/logic/attempt";
import { Incident } from "@/logic/interfaces";
import ResolvedIncidentsTable from "@/Pages/ResolvedIncidents/Components/ResolvedIncidentsTable";

const ResolvedIncidents = () => {
    const [search, setSearch] = useState<string>("");
    const [incidents, setIncidents] = useState<Incident[]>([]);

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
    }, [fetchData, search]);

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
                <ResolvedIncidentsTable data={incidents} />
            ) : (
                <Heading size="md">No resolved incidents found</Heading>
            )}
        </Flex>
    );
};

export default ResolvedIncidents;
