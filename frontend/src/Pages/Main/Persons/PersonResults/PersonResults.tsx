import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import FlagIcon from "@/Components/Icons/FlagIcon";
import LoadingPage from "@/Components/LoadingPage";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Person, Result } from "@/lib/interfaces";
import { getPersonById } from "@/lib/persons";
import { getAllResultsByPersonId } from "@/lib/results";

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
        <div className="flex flex-col gap-5">
            <Card>
                <CardHeader>
                    <CardTitle className="flex gap-2 justify-between items-center">
                        {person.name}
                        {person.countryIso2 && (
                            <div className="flex items-center gap-1">
                                <FlagIcon
                                    country={person.countryIso2}
                                    size={40}
                                />
                            </div>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Registrant ID: {person.registrantId}</p>
                    <p>WCA ID: {person.wcaId}</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Results</CardTitle>
                </CardHeader>
                <CardContent>
                    {results.length > 0 ? (
                        <PersonResultsTable results={results} />
                    ) : (
                        <div className="flex items-center justify-center">
                            <p className="text-lg">No results found</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default PersonResults;
