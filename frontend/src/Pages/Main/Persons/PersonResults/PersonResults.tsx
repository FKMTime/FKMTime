import { Box, Heading, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import FlagIcon from "@/Components/Icons/FlagIcon";
import LoadingPage from "@/Components/LoadingPage";
import { Person, Result } from "@/lib/interfaces";
import { getPersonById } from "@/lib/persons";
import { getAllResultsByPersonId } from "@/lib/results";
import { regionNameByIso2 } from "@/logic/utils";

import PersonResultsTable from "./Components/PersonResultsTable";

const PersonResults = () => {
    const { id } = useParams<{ id: string }>();
    const [results, setResults] = useState<Result[]>([]);
    const [person, setPerson] = useState<Person | null>();

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
        fetchData();
        fetchPersonData();
    }, [id]);

    if (!results || !person) {
        return <LoadingPage />;
    }

    return (
        <Box display="flex" flexDirection="column" gap="5" mt="2">
            <Heading>{person.name}</Heading>
            {person && (
                <>
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
                <PersonResultsTable results={results} />
            ) : (
                <Box display="flex" alignItems="center" justifyContent="center">
                    <Text fontSize="3xl">No results found</Text>
                </Box>
            )}
        </Box>
    );
};

export default PersonResults;
