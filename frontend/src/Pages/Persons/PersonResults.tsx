import { Box, Heading, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { Person, Result } from "../../logic/interfaces.ts";
import LoadingPage from "../../Components/LoadingPage.tsx";
import { getAllResultsByPersonId } from "../../logic/results.ts";
import { useParams } from "react-router-dom";
import PersonResultsTable from "../../Components/Table/PersonResultsTable.tsx";
import { getPersonById } from "../../logic/persons.ts";
import regions from "../../logic/regions.ts";
import { useAtom } from "jotai";
import { competitionAtom } from "../../logic/atoms.ts";
import { getCompetitionInfo } from "../../logic/competition.ts";

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
                    <Text fontSize="xl">
                        Representing:{" "}
                        {
                            regions.find(
                                (region) => region.iso2 === person.countryIso2
                            )?.name
                        }
                    </Text>
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
