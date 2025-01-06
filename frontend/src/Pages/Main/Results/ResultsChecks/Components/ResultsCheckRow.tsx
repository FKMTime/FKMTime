import { Box, Link, Td, Tr } from "@chakra-ui/react";
import { FaList } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import AttemptWarnings from "@/Components/AttemptWarnings";
import SmallIconButton from "@/Components/SmallIconButton";
import { activityCodeToName } from "@/lib/activities";
import { AttemptType, Incident } from "@/lib/interfaces";
import { attemptWithPenaltyToString } from "@/lib/resultFormatters";

interface ResultsCheckRowProps {
    check: Incident;
}

const ResultsCheckRow = ({ check }: ResultsCheckRowProps) => {
    const navigate = useNavigate();
    return (
        <TableRow>
            <TableCell>{check.result.person.name}</TableCell>
            <TableCell>
                <Link
                    onClick={() =>
                        navigate(`/results/round/${check.result.roundId}`)
                    }
                >
                    {activityCodeToName(check.result.roundId)}
                </Link>
            </TableCell>
            <TableCell>
                {check.type === AttemptType.EXTRA_ATTEMPT
                    ? `E${check.attemptNumber}`
                    : check.attemptNumber}
            </TableCell>
            <TableCell>{attemptWithPenaltyToString(check)}</TableCell>
            <TableCell>{check.comment}</TableCell>
            <TableCell>{check.judge?.name}</TableCell>
            <TableCell>
                <Box display="flex" gap={2}>
                    <AttemptWarnings attempt={check} />
                </Box>
            </TableCell>
            <TableCell>
                <SmallIconButton
                    icon={<FaList />}
                    ariaLabel="List"
                    title="View attempts"
                    onClick={() => navigate(`/results/${check.result.id}`)}
                />
            </TableCell>
        </TableRow>
    );
};

export default ResultsCheckRow;
