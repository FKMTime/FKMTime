import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import EmptyState from "@/Components/shared/EmptyState";
import RowActions from "@/Components/shared/RowActions";
import SearchInput from "@/Components/shared/SearchInput";
import { Button } from "@/Components/ui/button";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import { getEventIconClass } from "@/lib/events";
import { deleteManualIncident, getManualIncidents } from "@/lib/incidents";
import { ManualIncident } from "@/lib/interfaces";
import { cn, shortRoundName } from "@/lib/utils";

import { useIncidentsContext } from "../incidentsContext";
import CreateManualIncidentModal from "./Components/CreateManualIncidentModal";
import EditManualIncidentModal from "./Components/EditManualIncidentModal";

interface ManualIncidentsProps {
    /** /incidents/manual/create opens the add dialog straight away */
    createOnOpen?: boolean;
}

const ManualIncidents = ({ createOnOpen = false }: ManualIncidentsProps) => {
    const navigate = useNavigate();
    const confirm = useConfirm();
    const { toast } = useToast();
    const { refreshCounts } = useIncidentsContext();
    const [search, setSearch] = useState("");
    const [incidents, setIncidents] = useState<ManualIncident[]>([]);
    const [isCreateOpen, setIsCreateOpen] = useState(createOnOpen);
    const [editedIncident, setEditedIncident] = useState<ManualIncident | null>(
        null
    );

    const fetchData = useCallback(async (searchParam?: string) => {
        setIncidents(await getManualIncidents(searchParam));
    }, []);

    useEffect(() => {
        fetchData(search);
    }, [fetchData, search]);

    const refresh = () => {
        fetchData(search);
        refreshCounts();
    };

    const closeCreate = (created: boolean) => {
        setIsCreateOpen(false);
        if (created) refresh();
        if (createOnOpen) navigate("/incidents/manual", { replace: true });
    };

    const handleDelete = (incident: ManualIncident) => {
        confirm({
            title: `Delete the incident for ${incident.person.name}?`,
            confirmLabel: "Delete",
            onConfirm: async () => {
                const status = await deleteManualIncident(incident.id);
                if (status === 204) {
                    toast({
                        title: "Successfully deleted incident.",
                        variant: "success",
                    });
                    refresh();
                } else {
                    toast({
                        title: "Error",
                        description: "Something went wrong",
                        variant: "destructive",
                    });
                }
            },
        }).catch(() => undefined);
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <SearchInput
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    label="Search manual incidents"
                />
                <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus />
                    Add manual incident
                </Button>
            </div>

            {incidents.length === 0 ? (
                <EmptyState>No manual incidents.</EmptyState>
            ) : (
                <ul className="flex flex-col divide-y overflow-hidden rounded-mobile-card border bg-card md:rounded-2xl">
                    {incidents.map((incident) => (
                        <li
                            key={incident.id}
                            className="flex items-center gap-3 py-3 pl-4 pr-2 md:pl-5"
                        >
                            <div className="grid min-w-0 flex-1 gap-x-6 gap-y-0.5 text-sm md:grid-cols-[12rem_8rem_6rem_minmax(0,1fr)] md:items-baseline">
                                <p className="truncate font-semibold">
                                    {incident.person.name}
                                </p>
                                <p className="flex items-center gap-1.5 text-muted-foreground md:text-foreground">
                                    <span
                                        aria-hidden
                                        className={cn(
                                            "cubing-icon",
                                            getEventIconClass(
                                                incident.roundId.split("-")[0]
                                            )
                                        )}
                                    />
                                    {shortRoundName(incident.roundId)}
                                    <span className="md:hidden">
                                        · Attempt {incident.attempt || "—"}
                                    </span>
                                </p>
                                <p className="hidden text-muted-foreground md:block">
                                    Attempt {incident.attempt || "—"}
                                </p>
                                <p className="text-muted-foreground">
                                    {incident.description}
                                </p>
                            </div>
                            <RowActions
                                subject={incident.person.name}
                                primary={{
                                    label: "Edit",
                                    icon: Pencil,
                                    onSelect: () => setEditedIncident(incident),
                                }}
                                items={[
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

            <CreateManualIncidentModal
                isOpen={isCreateOpen}
                onClose={closeCreate}
            />
            {editedIncident && (
                <EditManualIncidentModal
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

export default ManualIncidents;
