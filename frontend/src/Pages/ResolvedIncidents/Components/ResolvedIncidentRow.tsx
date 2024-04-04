import { IconButton, Link, Td, Tr } from "@chakra-ui/react";
import { Competition } from "@wca/helpers";
import { FaList } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import { Incident } from "@/logic/interfaces.ts";
import { attemptWithPenaltyToString } from "@/logic/resultFormatters.ts";
import { getRoundNameById, prettyAttemptStatus } from "@/logic/utils.ts";

interface ResolvedIncidentRowProps {
    incident: Incident;
    wcif: Competition;
}

const ResolvedIncidentRow = ({ incident, wcif }: ResolvedIncidentRowProps) => {
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
                    {getRoundNameById(incident.result.roundId, wcif)}
                </Link>
            </Td>
            <Td>{incident.attemptNumber}</Td>
            <Td>{attemptWithPenaltyToString(incident)}</Td>
            <Td>{new Date(incident.solvedAt).toLocaleString()}</Td>
            <Td>{prettyAttemptStatus(incident.status, true)}</Td>
            <Td>{incident.judge?.name}</Td>
            <Td>
                <IconButton
                    icon={<FaList />}
                    aria-label="List"
                    bg="none"
                    color="white"
                    _hover={{
                        background: "none",
                        color: "gray.400",
                    }}
                    title="View attempts"
                    onClick={() => navigate(`/results/${incident.result.id}`)}
                />
            </Td>
        </Tr>
    );
};

export default ResolvedIncidentRow;
