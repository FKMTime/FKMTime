import { Copy, List, NotebookText, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import EmptyState from "@/Components/shared/EmptyState";
import RowActions, { RowAction } from "@/Components/shared/RowActions";
import SearchInput from "@/Components/shared/SearchInput";
import { Button } from "@/Components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { useToast } from "@/hooks/useToast";
import { getEventIconClass } from "@/lib/events";
import {
    getIncidentInfoText,
    getResolvedIncidents,
    saveAttemptAsNoteworthyIncident,
} from "@/lib/incidents";
import { Incident } from "@/lib/interfaces";
import { attemptWithPenaltyToString } from "@/lib/resultFormatters";
import { formatClockTime } from "@/lib/time";
import { cn, prettyAttemptStatus, shortRoundName } from "@/lib/utils";

import { useIncidentsContext } from "../incidentsContext";
import SummaryModal from "./Components/SummaryModal";

const ResolvedIncidents = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { refreshCounts } = useIncidentsContext();
    const [search, setSearch] = useState("");
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [isSummaryOpen, setIsSummaryOpen] = useState(false);

    const fetchData = useCallback(async (searchParam?: string) => {
        setIncidents(await getResolvedIncidents(searchParam));
    }, []);

    useEffect(() => {
        fetchData(search);
    }, [fetchData, search]);

    const handleSaveAsNoteworthy = async (incident: Incident) => {
        const status = await saveAttemptAsNoteworthyIncident(incident.id);
        if (status === 201) {
            toast({
                title: "Incident saved as noteworthy",
                variant: "success",
            });
            refreshCounts();
        } else if (status === 409) {
            toast({
                title: "This attempt is already marked as noteworthy",
                variant: "destructive",
            });
        } else {
            toast({
                title: "Failed to save incident as noteworthy",
                variant: "destructive",
            });
        }
    };

    const handleCopy = (incident: Incident) => {
        navigator.clipboard.writeText(getIncidentInfoText(incident));
        toast({ title: "Copied to clipboard", variant: "success" });
    };

    const actions = (incident: Incident) => {
        const primary: RowAction = {
            label: "View attempts",
            icon: List,
            onSelect: () => navigate(`/results/${incident.result.id}`),
        };
        const items: RowAction[] = [
            {
                label: "Copy incident info",
                icon: Copy,
                onSelect: () => handleCopy(incident),
            },
            {
                label: "Save as noteworthy",
                icon: Save,
                onSelect: () => handleSaveAsNoteworthy(incident),
            },
        ];
        return (
            <RowActions
                subject={incident.result.person.name}
                primary={primary}
                items={items}
            />
        );
    };

    const roundLink = (incident: Incident) => (
        <Link
            to={`/results/round/${incident.result.roundId}`}
            className="inline-flex items-center gap-1.5 whitespace-nowrap text-primary hover:underline"
        >
            <span
                aria-hidden
                className={cn(
                    "cubing-icon",
                    getEventIconClass(incident.result.eventId)
                )}
            />
            {shortRoundName(incident.result.roundId)}
        </Link>
    );

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <SearchInput
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    label="Search resolved incidents"
                />
                <Button
                    variant="outline"
                    onClick={() => setIsSummaryOpen(true)}
                >
                    <NotebookText />
                    Summary
                </Button>
            </div>

            {incidents.length === 0 ? (
                <EmptyState>No resolved incidents found.</EmptyState>
            ) : (
                <>
                    <div className="hidden overflow-x-auto rounded-2xl border bg-card md:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-5">
                                        Competitor
                                    </TableHead>
                                    <TableHead>Round</TableHead>
                                    <TableHead>Attempt</TableHead>
                                    <TableHead>Time</TableHead>
                                    <TableHead>Solved</TableHead>
                                    <TableHead>By</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Comment</TableHead>
                                    <TableHead>Judge</TableHead>
                                    <TableHead>
                                        <span className="sr-only">Actions</span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {incidents.map((incident) => (
                                    <TableRow key={incident.id}>
                                        <TableCell className="pl-5 font-semibold">
                                            {incident.result.person.name}
                                        </TableCell>
                                        <TableCell>
                                            {roundLink(incident)}
                                        </TableCell>
                                        <TableCell>
                                            {incident.attemptNumber}
                                        </TableCell>
                                        <TableCell className="font-semibold">
                                            {attemptWithPenaltyToString(
                                                incident
                                            )}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {incident.solvedAt &&
                                                formatClockTime(
                                                    incident.solvedAt
                                                )}
                                        </TableCell>
                                        <TableCell>
                                            {incident.updatedBy?.fullName}
                                        </TableCell>
                                        <TableCell>
                                            {prettyAttemptStatus(
                                                incident.status,
                                                true
                                            )}
                                        </TableCell>
                                        <TableCell className="max-w-56 truncate text-muted-foreground">
                                            {incident.comment || "—"}
                                        </TableCell>
                                        <TableCell>
                                            {incident.judge?.name}
                                        </TableCell>
                                        <TableCell className="pr-3">
                                            {actions(incident)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <ul className="flex flex-col divide-y overflow-hidden rounded-mobile-card border bg-card md:hidden">
                        {incidents.map((incident) => (
                            <li
                                key={incident.id}
                                className="flex items-start gap-2 py-3 pl-4 pr-1.5"
                            >
                                <div className="min-w-0 flex-1 text-sm">
                                    <p className="flex flex-wrap items-baseline gap-x-2 font-semibold">
                                        {incident.result.person.name}
                                        <span className="font-normal">
                                            {roundLink(incident)} · A
                                            {incident.attemptNumber}
                                        </span>
                                        <span className="ml-auto">
                                            {attemptWithPenaltyToString(
                                                incident
                                            )}
                                        </span>
                                    </p>
                                    <p className="text-[13px] text-muted-foreground">
                                        {[
                                            prettyAttemptStatus(
                                                incident.status,
                                                true
                                            ),
                                            incident.updatedBy?.fullName,
                                            incident.solvedAt &&
                                                formatClockTime(
                                                    incident.solvedAt
                                                ),
                                        ]
                                            .filter(Boolean)
                                            .join(" · ")}
                                    </p>
                                    <p className="text-[13px] text-muted-foreground">
                                        {[
                                            incident.comment,
                                            incident.judge &&
                                                `Judge ${incident.judge.name}`,
                                        ]
                                            .filter(Boolean)
                                            .join(" · ")}
                                    </p>
                                </div>
                                {actions(incident)}
                            </li>
                        ))}
                    </ul>
                </>
            )}

            <SummaryModal
                incidents={incidents}
                isOpen={isSummaryOpen}
                onClose={() => setIsSummaryOpen(false)}
            />
        </div>
    );
};

export default ResolvedIncidents;
