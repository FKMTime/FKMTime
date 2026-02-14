/* eslint-disable react-hooks/set-state-in-effect, react-hooks/preserve-manual-memoization */
import { MessageSquareDot, NotebookText } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Input } from "@/Components/ui/input";
import { getResolvedIncidents } from "@/lib/incidents";
import { Incident } from "@/lib/interfaces";
import PageTransition from "@/Pages/PageTransition";

import ResolvedIncidentsTable from "./Components/ResolvedIncidentsTable";
import SummaryModal from "./Components/SummaryModal";

const ResolvedIncidents = () => {
    const [search, setSearch] = useState<string>("");
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [isOpenSummaryModal, setIsOpenSummaryModal] =
        useState<boolean>(false);

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
        <PageTransition>
            <div className="flex flex-col gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex justify-between items-center">
                            <div className="flex gap-2 items-center">
                                <MessageSquareDot size={20} />
                                Resolved incidents
                            </div>
                            <Button onClick={() => setIsOpenSummaryModal(true)}>
                                <NotebookText />
                                Summary
                            </Button>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Input
                            placeholder="Search"
                            value={search}
                            onChange={handleSearch}
                        />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex gap-2 items-center">
                            <MessageSquareDot size={20} />
                            Resolved incidents
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {incidents.length > 0 ? (
                            <ResolvedIncidentsTable data={incidents} />
                        ) : (
                            <h2 className="text-lg">
                                No resolved incidents found
                            </h2>
                        )}
                    </CardContent>
                </Card>
                <SummaryModal
                    incidents={incidents}
                    isOpen={isOpenSummaryModal}
                    onClose={() => setIsOpenSummaryModal(false)}
                />
            </div>
        </PageTransition>
    );
};

export default ResolvedIncidents;
