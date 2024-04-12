import { IconButton, Td, Tr } from "@chakra-ui/react";
import { FaList } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import { isAdmin } from "@/logic/auth";
import { average, best } from "@/logic/average";
import { Result } from "@/logic/interfaces";
import {
    attemptWithPenaltyToString,
    resultToString,
} from "@/logic/resultFormatters";
import { getSubmittedAttempts, isMobileView } from "@/logic/utils";

interface ResultRowProps {
    result: Result;
    maxAttempts: number;
}

const ResultRow = ({ result, maxAttempts }: ResultRowProps) => {
    const navigate = useNavigate();

    const submittedAttempts = getSubmittedAttempts(result.attempts);
    const calculatedAverage =
        submittedAttempts.length === maxAttempts && average(submittedAttempts);

    return (
        <>
            <Tr key={result.id}>
                <Td>
                    {result.person.name} ({result.person.registrantId})
                </Td>
                {!isMobileView() &&
                    Array.from({ length: maxAttempts }, (_, i) => (
                        <Td key={i}>
                            {submittedAttempts.length > i
                                ? attemptWithPenaltyToString(
                                      submittedAttempts[i]
                                  )
                                : ""}
                        </Td>
                    ))}
                <Td>
                    {calculatedAverage ? resultToString(calculatedAverage) : ""}
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

export default ResultRow;
