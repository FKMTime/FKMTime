import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import EmptyState from "@/Components/shared/EmptyState";
import RowActions from "@/Components/shared/RowActions";
import SearchInput from "@/Components/shared/SearchInput";
import { Button } from "@/Components/ui/button";
import { useDeferredDelete } from "@/hooks/useDeferredDelete";
import { Warning } from "@/lib/interfaces";
import { deleteWarning, getAllWarnings } from "@/lib/warnings";

import { useIncidentsContext } from "../incidentsContext";
import AddWarningModal from "./Components/AddWarningModal";

const Warnings = () => {
    const { refreshCounts } = useIncidentsContext();
    const [search, setSearch] = useState("");
    const [warnings, setWarnings] = useState<Warning[]>([]);
    const [isAddOpen, setIsAddOpen] = useState(false);

    const fetchData = useCallback(async (searchParam?: string) => {
        setWarnings(await getAllWarnings(searchParam));
    }, []);

    useEffect(() => {
        fetchData(search);
    }, [fetchData, search]);

    const refresh = () => {
        fetchData(search);
        refreshCounts();
    };

    const { deleteLater, isPending } = useDeferredDelete({
        remove: deleteWarning,
        onDeleted: refresh,
    });

    const handleDelete = (warning: Warning) =>
        deleteLater(warning.id, `Warning for ${warning.person.name} deleted`);

    const visibleWarnings = warnings.filter((item) => !isPending(item.id));

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <SearchInput
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    label="Search warnings"
                />
                <Button onClick={() => setIsAddOpen(true)}>
                    <Plus />
                    Add warning
                </Button>
            </div>

            {visibleWarnings.length === 0 ? (
                <EmptyState>No warnings issued.</EmptyState>
            ) : (
                <ul className="flex flex-col divide-y overflow-hidden rounded-mobile-card border bg-card md:rounded-2xl">
                    {visibleWarnings.map((warning) => (
                        <li
                            key={warning.id}
                            className="flex items-center gap-3 py-3 pl-4 pr-2 md:pl-5"
                        >
                            <div className="min-w-0 flex-1 md:flex md:items-baseline md:gap-6">
                                <p className="shrink-0 font-semibold md:w-48 md:truncate">
                                    {warning.person.name}
                                </p>
                                <p className="min-w-0 flex-1 text-sm">
                                    {warning.description}
                                </p>
                                {warning.createdBy?.fullName && (
                                    <p className="text-xs text-faint md:text-sm">
                                        by {warning.createdBy.fullName}
                                    </p>
                                )}
                            </div>
                            <RowActions
                                subject={warning.person.name}
                                primary={{
                                    label: "Delete warning",
                                    icon: Trash2,
                                    onSelect: () => handleDelete(warning),
                                }}
                            />
                        </li>
                    ))}
                </ul>
            )}

            <AddWarningModal
                isOpen={isAddOpen}
                onClose={(created) => {
                    setIsAddOpen(false);
                    if (created) refresh();
                }}
            />
        </div>
    );
};

export default Warnings;
