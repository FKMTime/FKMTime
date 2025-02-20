import { List, Save } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import EventIcon from "@/Components/Icons/EventIcon";
import SmallIconButton from "@/Components/SmallIconButton";
import { TableCell, TableRow } from "@/Components/ui/table";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName } from "@/lib/activities";
import { saveAttemptAsNoteworthyIncident } from "@/lib/incidents";
import { Incident } from "@/lib/interfaces";
import { attemptWithPenaltyToString } from "@/lib/resultFormatters";
import { prettyAttemptStatus } from "@/lib/utils.ts";

interface ResolvedIncidentRowProps {
    incident: Incident;
}

const ResolvedIncidentRow = ({ incident }: ResolvedIncidentRowProps) => {
    const navigate = useNavigate();
    const { toast } = useToast();

    const handleSaveAsNoteworthy = async () => {
        const status = await saveAttemptAsNoteworthyIncident(incident.id);

        if (status === 201) {
            toast({
                title: "Incident saved as noteworthy",
                variant: "success",
            });
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

    return (
        <TableRow>
            <TableCell>{incident.result.person.name}</TableCell>
            <TableCell>
                <Link
                    className="text-blue-500 flex items-center gap-1"
                    to={`/results/round/${incident.result.roundId}`}
                >
                    <EventIcon
                        selected
                        eventId={incident.result.roundId.split("-")[0]}
                    />
                    {activityCodeToName(incident.result.roundId)}
                </Link>
            </TableCell>
            <TableCell>{incident.attemptNumber}</TableCell>
            <TableCell>{attemptWithPenaltyToString(incident)}</TableCell>
            <TableCell>
                {new Date(incident.solvedAt).toLocaleString()}
            </TableCell>
            <TableCell>{incident.updatedBy?.fullName}</TableCell>
            <TableCell>{prettyAttemptStatus(incident.status, true)}</TableCell>
            <TableCell>{incident.comment}</TableCell>
            <TableCell>{incident.judge?.name}</TableCell>
            <TableCell>
                <SmallIconButton
                    icon={<Save />}
                    title="Save as noteworthy"
                    onClick={handleSaveAsNoteworthy}
                />
                <SmallIconButton
                    icon={<List />}
                    title="View attempts"
                    onClick={() => navigate(`/results/${incident.result.id}`)}
                />
            </TableCell>
        </TableRow>
    );
};

export default ResolvedIncidentRow;
