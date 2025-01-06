import { Td, Tr } from "@chakra-ui/react";
import { FaList } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import SmallIconButton from "@/Components/SmallIconButton";
import { activityCodeToName } from "@/lib/activities";
import { isAdmin } from "@/lib/auth";
import { average, best } from "@/lib/average";
import { Result } from "@/lib/interfaces";
import { resultToString } from "@/lib/resultFormatters";
import { getSubmittedAttempts } from "@/logic/utils";

interface PersonResultRowProps {
    result: Result;
}

const PersonResultRow = ({ result }: PersonResultRowProps) => {
    const navigate = useNavigate();

    const submittedAttempts = getSubmittedAttempts(result.attempts);
    const calculatedAverage = average(submittedAttempts);

    return (
        <>
            <TableRow key={result.id}>
                <TableCell>{activityCodeToName(result.roundId)}</TableCell>
                <TableCell>
                    {calculatedAverage
                        ? resultToString(calculatedAverage)
                        : "No average"}
                </TableCell>
                <TableCell>{resultToString(best(submittedAttempts))}</TableCell>
                {isAdmin() && (
                    <TableCell>
                        <SmallIconButton
                            icon={<FaList />}
                            ariaLabel="List"
                            title="View attempts"
                            onClick={() => navigate(`/results/${result.id}`)}
                        />
                    </TableCell>
                )}
            </TableRow>
        </>
    );
};

export default PersonResultRow;
