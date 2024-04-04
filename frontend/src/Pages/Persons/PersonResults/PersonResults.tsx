import { Box, Heading, Text } from "@chakra-ui/react";
import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import FlagIcon from "@/Components/Icons/FlagIcon";
import LoadingPage from "@/Components/LoadingPage";
import { competitionAtom } from "@/logic/atoms";
import { getCompetitionInfo } from "@/logic/competition";
import { Person, Result } from "@/logic/interfaces";
import { getPersonById } from "@/logic/persons";
import { getAllResultsByPersonId } from "@/logic/results";
import { regionNameByIso2 } from "@/logic/utils";

import PersonResultsTable from "./Components/PersonResultsTable";

const PersonResults = () => {
    const { id } = useParams<{ id: string }>();
    const [results, setResults] = useState<Result[]>([]);
    const [person, setPerson] = useState<Person | null>();
    const [competition, setCompetition] = useAtom(competitionAtom);

    useEffect(() => {
        const fetchData = async () => {
            if (!id) return;
            const data = await getAllResultsByPersonId(id);
            setResults(data);
        };
        const fetchPersonData = async () => {
            if (!id) return;
            const data = await getPersonById(id);
            setPerson(data);
        };
        const fetchCompetitionData = async () => {
            if (competition) return;
            const res = await getCompetitionInfo();
            setCompetition(res.data);
        };
        fetchCompetitionData();
        fetchData();
        fetchPersonData();
    }, [id, competition, setCompetition]);

    if (!results || !person || !competition) {
        return <LoadingPage />;
    }

    return (
        <Box display="flex" flexDirection="column" gap="5">
            <Heading>Results</Heading>
            {person && (
                <>
                    <Text fontSize="xl">Name: {person.name}</Text>
                    <Text fontSize="xl">
                        Registrant ID: {person.registrantId}
                    </Text>
                    <Text fontSize="xl">WCA ID: {person.wcaId}</Text>
                    {person.countryIso2 && (
                        <Text fontSize="xl">
                            <Box display="flex" alignItems="center" gap="1">
                                <Text>
                                    Representing:{" "}
                                    {regionNameByIso2(person.countryIso2)}
                                </Text>
                                <FlagIcon
                                    country={person.countryIso2}
                                    size={20}
                                />
                            </Box>
                        </Text>
                    )}
                </>
            )}
            {results.length > 0 ? (
                <PersonResultsTable
                    results={results}
                    wcif={competition?.wcif}
                />
            ) : (
                <Box display="flex" alignItems="center" justifyContent="center">
                    <Text fontSize="3xl">No results found</Text>
                </Box>
            )}
        </Box>
    );
};

export default PersonResults;
