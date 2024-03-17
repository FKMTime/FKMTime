import { IconButton, Td, Tr } from "@chakra-ui/react";
import { Result } from "../../../logic/interfaces";
import { FaList } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { getUserInfo } from "../../../logic/auth.ts";
import { HAS_WRITE_ACCESS } from "../../../logic/accounts.ts";
import { getSubmittedAttempts } from "../../../logic/utils.ts";
import { average, best } from "../../../logic/average.ts";
import {
    attemptWithPenaltyToString,
    resultToString,
} from "../../../logic/resultFormatters.ts";

interface ResultRowProps {
    result: Result;
    maxAttempts: number;
}

const ResultRow: React.FC<ResultRowProps> = ({ result, maxAttempts }) => {
    const navigate = useNavigate();
    const userInfo = getUserInfo();

    const submittedAttempts = getSubmittedAttempts(result.attempts);
    const calculatedAverage =
        submittedAttempts.length === maxAttempts && average(submittedAttempts);

    return (
        <>
            <Tr key={result.id}>
                <Td>
                    {result.person.name} ({result.person.registrantId})
                </Td>
                {Array.from({ length: maxAttempts }, (_, i) => (
                    <Td key={i}>
                        {submittedAttempts.length > i
                            ? attemptWithPenaltyToString(submittedAttempts[i])
                            : ""}
                    </Td>
                ))}
                <Td>
                    {calculatedAverage ? resultToString(calculatedAverage) : ""}
                </Td>
                <Td>{resultToString(best(submittedAttempts))}</Td>
                {HAS_WRITE_ACCESS.includes(userInfo.role) && (
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
