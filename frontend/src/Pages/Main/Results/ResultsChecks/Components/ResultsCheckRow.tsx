import { Box, Link, Td, Tr } from "@chakra-ui/react";
import { FaList } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import AttemptWarnings from "@/Components/AttemptWarnings";
import SmallIconButton from "@/Components/SmallIconButton";
import { activityCodeToName } from "@/logic/activities";
import { AttemptType, Incident } from "@/logic/interfaces.ts";
import { attemptWithPenaltyToString } from "@/logic/resultFormatters.ts";

interface ResultsCheckRowProps {
    check: Incident;
}

const ResultsCheckRow = ({ check }: ResultsCheckRowProps) => {
    const navigate = useNavigate();
    return (
        <Tr>
            <Td>{check.result.person.name}</Td>
            <Td>
                <Link
                    onClick={() =>
                        navigate(`/results/round/${check.result.roundId}`)
                    }
                >
                    {activityCodeToName(check.result.roundId)}
                </Link>
            </Td>
            <Td>
                {check.type === AttemptType.EXTRA_ATTEMPT
                    ? `E${check.attemptNumber}`
                    : check.attemptNumber}
            </Td>
            <Td>{attemptWithPenaltyToString(check)}</Td>
            <Td>{check.comment}</Td>
            <Td>{check.judge?.name}</Td>
            <Td>
                <Box display="flex" gap={2}>
                    <AttemptWarnings attempt={check} />
                </Box>
            </Td>
            <Td>
                <SmallIconButton
                    icon={<FaList />}
                    ariaLabel="List"
                    title="View attempts"
                    onClick={() => navigate(`/results/${check.result.id}`)}
                />
            </Td>
        </Tr>
    );
};

export default ResultsCheckRow;
