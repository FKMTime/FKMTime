import { Link, Td, Tr } from "@chakra-ui/react";
import { FaList } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import SmallIconButton from "@/Components/SmallIconButton";
import { activityCodeToName } from "@/logic/activities";
import { Incident } from "@/logic/interfaces.ts";
import { attemptWithPenaltyToString } from "@/logic/resultFormatters.ts";
import { prettyAttemptStatus } from "@/logic/utils.ts";

interface ResolvedIncidentRowProps {
    incident: Incident;
}

const ResolvedIncidentRow = ({ incident }: ResolvedIncidentRowProps) => {
    const navigate = useNavigate();
    return (
        <Tr>
            <Td>{incident.result.person.name}</Td>
            <Td>
                <Link
                    onClick={() =>
                        navigate(`/results/round/${incident.result.roundId}`)
                    }
                >
                    {activityCodeToName(incident.result.roundId)}
                </Link>
            </Td>
            <Td>{incident.attemptNumber}</Td>
            <Td>{attemptWithPenaltyToString(incident)}</Td>
            <Td>{new Date(incident.solvedAt).toLocaleString()}</Td>
            <Td>{incident.updatedBy?.fullName}</Td>
            <Td>{prettyAttemptStatus(incident.status, true)}</Td>
            <Td>{incident.comment}</Td>
            <Td>{incident.judge?.name}</Td>
            <Td>
                <SmallIconButton
                    icon={<FaList />}
                    ariaLabel="List"
                    title="View attempts"
                    onClick={() => navigate(`/results/${incident.result.id}`)}
                />
            </Td>
        </Tr>
    );
};

export default ResolvedIncidentRow;
