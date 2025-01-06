import { Link, Td, Tr } from "@chakra-ui/react";
import { FaList } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import SmallIconButton from "@/Components/SmallIconButton";
import { activityCodeToName } from "@/lib/activities";
import { Incident } from "@/lib/interfaces";
import { attemptWithPenaltyToString } from "@/lib/resultFormatters";
import { prettyAttemptStatus } from "@/logic/utils.ts";

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
                    onClick={() =>
                        navigate(`/results/round/${incident.result.roundId}`)
                    }
                >
                    {activityCodeToName(incident.result.roundId)}
                </Link>
            </TableCell>
            <TableCell>{incident.attemptNumber}</TableCell>
            <TableCell>{attemptWithPenaltyToString(incident)}</TableCell>
            <TableCell>{new Date(incident.solvedAt).toLocaleString()}</TableCell>
            <TableCell>{incident.updatedBy?.fullName}</TableCell>
            <TableCell>{prettyAttemptStatus(incident.status, true)}</TableCell>
            <TableCell>{incident.comment}</TableCell>
            <TableCell>{incident.judge?.name}</TableCell>
            <TableCell>
                <SmallIconButton
                    icon={<FaList />}
                    ariaLabel="List"
                    title="View attempts"
                    onClick={() => navigate(`/results/${incident.result.id}`)}
                />
            </TableCell>
        </TableRow>
    );
};

export default ResolvedIncidentRow;
