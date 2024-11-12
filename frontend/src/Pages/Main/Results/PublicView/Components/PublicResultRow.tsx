import { Td, Tr } from "@chakra-ui/react";

import { ResultWithAverage } from "@/logic/interfaces";
import { attemptWithPenaltyToString } from "@/logic/resultFormatters";
import { getSubmittedAttempts, isMobileView } from "@/logic/utils";

interface PublicResultRowProps {
    result: ResultWithAverage;
    maxAttempts: number;
    pos: number;
}

const PublicResultRow = ({
    result,
    maxAttempts,
    pos,
}: PublicResultRowProps) => {
    const submittedAttempts = getSubmittedAttempts(result.attempts);
    return (
        <>
            <Tr key={result.id}>
                <Td>{pos}</Td>
                <Td>{result.person.name}</Td>
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
                <Td>{result.averageString}</Td>
                <Td>{result.bestString}</Td>
            </Tr>
        </>
    );
};

export default PublicResultRow;
