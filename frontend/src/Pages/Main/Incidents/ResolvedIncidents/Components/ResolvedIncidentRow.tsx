import { FaList } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";

import EventIcon from "@/Components/Icons/EventIcon";
import SmallIconButton from "@/Components/SmallIconButton";
import { TableCell, TableRow } from "@/Components/ui/table";
import { activityCodeToName } from "@/lib/activities";
import { Incident } from "@/lib/interfaces";
import { attemptWithPenaltyToString } from "@/lib/resultFormatters";
import { prettyAttemptStatus } from "@/lib/utils.ts";

interface ResolvedIncidentRowProps {
    incident: Incident;
}

const ResolvedIncidentRow = ({ incident }: ResolvedIncidentRowProps) => {
    const navigate = useNavigate();
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
                    icon={<FaList />}
                    title="View attempts"
                    onClick={() => navigate(`/results/${incident.result.id}`)}
                />
            </TableCell>
        </TableRow>
    );
};

export default ResolvedIncidentRow;
