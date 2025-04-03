import { FileWarning } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Input } from "@/Components/ui/input";
import { Warning } from "@/lib/interfaces";
import { getAllWarnings } from "@/lib/warnings";
import PageTransition from "@/Pages/PageTransition";

import WarningsTable from "./Components/WarningsTable";

const Warnings = () => {
    const [search, setSearch] = useState<string>("");
    const [warnings, setWarnings] = useState<Warning[]>([]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        fetchData(e.target.value);
    };

    const fetchData = useCallback(async (searchParam?: string) => {
        const data = await getAllWarnings(searchParam);
        setWarnings(data);
    }, []);

    useEffect(() => {
        fetchData(search);
    }, [fetchData, search]);

    return (
        <PageTransition>
            <div className="flex flex-col gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex gap-2 items-center">
                            <FileWarning size={20} />
                            Warnings
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
                            <FileWarning size={20} />
                            Warnings
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {warnings.length > 0 ? (
                            <WarningsTable
                                data={warnings}
                                fetchData={fetchData}
                            />
                        ) : (
                            <h2 className="text-lg">No warnings found</h2>
                        )}
                    </CardContent>
                </Card>
            </div>
        </PageTransition>
    );
};

export default Warnings;
