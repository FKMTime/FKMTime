import { Td, Tr } from "@chakra-ui/react";
import { FaList } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import SmallIconButton from "@/Components/SmallIconButton";
import { activityCodeToName } from "@/logic/activities";
import { isAdmin } from "@/logic/auth";
import { average, best } from "@/logic/average";
import { Result } from "@/logic/interfaces";
import { resultToString } from "@/logic/resultFormatters";
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
            <Tr key={result.id}>
                <Td>{activityCodeToName(result.roundId)}</Td>
                <Td>
                    {calculatedAverage
                        ? resultToString(calculatedAverage)
                        : "No average"}
                </Td>
                <Td>{resultToString(best(submittedAttempts))}</Td>
                {isAdmin() && (
                    <Td>
                        <SmallIconButton
                            icon={<FaList />}
                            ariaLabel="List"
                            title="View attempts"
                            onClick={() => navigate(`/results/${result.id}`)}
                        />
                    </Td>
                )}
            </Tr>
        </>
    );
};

export default PersonResultRow;
