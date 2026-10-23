import { List, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import EmptyState from "@/Components/shared/EmptyState";
import RowActions from "@/Components/shared/RowActions";
import SearchInput from "@/Components/shared/SearchInput";
import { Button } from "@/Components/ui/button";
import { useDeferredDelete } from "@/hooks/useDeferredDelete";
import {
    deleteNoteworthyIncident,
    getNoteworthyIncidents,
} from "@/lib/incidents";
import { NoteworthyIncident } from "@/lib/interfaces";

import { useIncidentsContext } from "../incidentsContext";
import CreateNoteworthyIncidentModal from "./Components/CreateNoteworthyIncidentModal";
import EditNoteworthyIncidentModal from "./Components/EditNoteworthyIncidentModal";

const NoteworthyIncidents = () => {
    const navigate = useNavigate();
    const { refreshCounts } = useIncidentsContext();
    const [search, setSearch] = useState("");
    const [incidents, setIncidents] = useState<NoteworthyIncident[]>([]);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editedIncident, setEditedIncident] =
        useState<NoteworthyIncident | null>(null);

    const fetchData = useCallback(async (searchParam?: string) => {
        setIncidents(await getNoteworthyIncidents(searchParam));
    }, []);

    useEffect(() => {
        fetchData(search);
    }, [fetchData, search]);

    const refresh = () => {
        fetchData(search);
        refreshCounts();
    };

    const { deleteLater, isPending } = useDeferredDelete({
        remove: deleteNoteworthyIncident,
        onDeleted: refresh,
    });

    const handleDelete = (incident: NoteworthyIncident) =>
        deleteLater(incident.id, `"${incident.title}" deleted`);

    const visibleIncidents = incidents.filter((item) => !isPending(item.id));

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <SearchInput
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    label="Search noteworthy incidents"
                />
                <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus />
                    Add noteworthy incident
                </Button>
            </div>

            {visibleIncidents.length === 0 ? (
                <EmptyState>No noteworthy incidents.</EmptyState>
            ) : (
                <ul className="flex flex-col gap-3">
                    {visibleIncidents.map((incident) => (
                        <li
                            key={incident.id}
                            className="flex items-start gap-3 rounded-mobile-card border bg-card py-3.5 pl-4 pr-2 md:rounded-2xl md:py-4 md:pl-5"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="font-semibold">
                                    {incident.title}
                                </p>
                                {incident.description && (
                                    <p className="mt-0.5 text-sm text-muted-foreground">
                                        {incident.description}
                                    </p>
                                )}
                                {incident.createdBy?.fullName && (
                                    <p className="mt-1 text-xs text-faint">
                                        by {incident.createdBy.fullName}
                                    </p>
                                )}
                            </div>
                            <RowActions
                                subject={incident.title}
                                primary={{
                                    label: "Edit",
                                    icon: Pencil,
                                    onSelect: () => setEditedIncident(incident),
                                }}
                                items={[
                                    {
                                        label: "View attempts",
                                        icon: List,
                                        hidden: !incident.attempt,
                                        onSelect: () =>
                                            navigate(
                                                `/results/${incident.attempt?.resultId}`
                                            ),
                                    },
                                    {
                                        label: "Delete",
                                        icon: Trash2,
                                        destructive: true,
                                        onSelect: () => handleDelete(incident),
                                    },
                                ]}
                            />
                        </li>
                    ))}
                </ul>
            )}

            <CreateNoteworthyIncidentModal
                isOpen={isCreateOpen}
                onClose={() => {
                    setIsCreateOpen(false);
                    refresh();
                }}
            />
            {editedIncident && (
                <EditNoteworthyIncidentModal
                    incident={editedIncident}
                    isOpen
                    onClose={() => {
                        setEditedIncident(null);
                        refresh();
                    }}
                />
            )}
        </div>
    );
};

export default NoteworthyIncidents;
