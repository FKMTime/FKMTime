import { IconButton, Td, Tr } from "@chakra-ui/react";
import { activityCodeToName } from "@wca/helpers";
import { FaList } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

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
                <Td>{activityCodeToName(result.eventId)}</Td>
                <Td>
                    {calculatedAverage
                        ? resultToString(calculatedAverage)
                        : "No average"}
                </Td>
                <Td>{resultToString(best(submittedAttempts))}</Td>
                {isAdmin() && (
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
                            onClick={() => navigate(`/results/${result.id}`)}
                        />
                    </Td>
                )}
            </Tr>
        </>
    );
};

export default PersonResultRow;
