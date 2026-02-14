/* eslint-disable react-hooks/preserve-manual-memoization */
import { NotebookPen } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import PlusButton from "@/Components/PlusButton";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/Components/ui/card";
import { Input } from "@/Components/ui/input";
import { getNoteworthyIncidents } from "@/lib/incidents";
import { NoteworthyIncident } from "@/lib/interfaces";
import PageTransition from "@/Pages/PageTransition";

import CreateNoteworthyIncidentModal from "./Components/CreateNoteworthyIncidentModal";
import NoteworthyIncidentsTable from "./Components/NoteworthyIncidentsTable";

const NoteworthyIncidents = () => {
    const [search, setSearch] = useState<string>("");
    const [incidents, setIncidents] = useState<NoteworthyIncident[]>([]);
    const [
        isOpenCreateNoteworthyIncidentModal,
        setIsOpenCreateNoteworthyIncidentModal,
    ] = useState<boolean>(false);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        fetchData(e.target.value);
    };

    const fetchData = useCallback(async (searchParam?: string) => {
        const data = await getNoteworthyIncidents(searchParam);
        setIncidents(data);
    }, []);

    const handleClose = () => {
        fetchData();
        setIsOpenCreateNoteworthyIncidentModal(false);
    };

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
                                Noteworthy incidents
                            </div>
                            <PlusButton
                                onClick={() =>
                                    setIsOpenCreateNoteworthyIncidentModal(true)
                                }
                            />
                        </CardTitle>
                        <CardDescription>
                            You can add attempt as noteworthy in the resolved
                            incidents page or note a custom incident, not
                            related to any attempt.
                        </CardDescription>
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
                            <NotebookPen size={20} />
                            Noteworthy incidents
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {incidents.length > 0 ? (
                            <NoteworthyIncidentsTable
                                data={incidents}
                                fetchData={fetchData}
                            />
                        ) : (
                            <h2 className="text-lg">
                                No noteworthy incidents found
                            </h2>
                        )}
                    </CardContent>
                </Card>
            </div>
            <CreateNoteworthyIncidentModal
                isOpen={isOpenCreateNoteworthyIncidentModal}
                onClose={handleClose}
            />
        </PageTransition>
    );
};

export default NoteworthyIncidents;
