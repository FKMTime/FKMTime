/* eslint-disable react-hooks/set-state-in-effect, react-hooks/preserve-manual-memoization */
import { NotebookPen } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import PlusButton from "@/Components/PlusButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Input } from "@/Components/ui/input";
import { getManualIncidents } from "@/lib/incidents";
import { ManualIncident } from "@/lib/interfaces";
import PageTransition from "@/Pages/PageTransition";

import ManualIncidentsTable from "./Components/ManualIncidentsTable";

const ManualIncidents = () => {
    const navigate = useNavigate();
    const [search, setSearch] = useState<string>("");
    const [incidents, setIncidents] = useState<ManualIncident[]>([]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        fetchData(e.target.value);
    };

    const fetchData = useCallback(async (searchParam?: string) => {
        const data = await getManualIncidents(searchParam);
        setIncidents(data);
    }, []);

    useEffect(() => {
        fetchData(search);
    }, [fetchData, search]);

    return (
        <PageTransition>
            <div className="flex flex-col gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex justify-between items-center">
                            <div className="flex gap-2 items-center">
                                <NotebookPen size={20} />
                                Incidents
                            </div>
                            <PlusButton
                                onClick={() =>
                                    navigate("/incidents/manual/create")
                                }
                            />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Input
                            placeholder="Search"
                            value={search}
                            onChange={handleSearch}
                        />
                        {incidents.length === 0 && (
                            <h2 className="text-lg mt-4">No incidents found</h2>
                        )}
                    </CardContent>
                </Card>
                {incidents.length > 0 ? (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex gap-2 items-center">
                                <NotebookPen size={20} />
                                Incidents
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ManualIncidentsTable
                                data={incidents}
                                fetchData={fetchData}
                            />
                        </CardContent>
                    </Card>
                ) : null}
            </div>
        </PageTransition>
    );
};

export default ManualIncidents;
