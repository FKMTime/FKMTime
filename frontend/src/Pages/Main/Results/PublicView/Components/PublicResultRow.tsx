import { Td, Tr } from "@chakra-ui/react";

import { ResultWithAverage } from "@/lib/interfaces";
import { attemptWithPenaltyToString } from "@/lib/resultFormatters";
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
            <TableRow key={result.id}>
                <TableCell>{pos}</TableCell>
                <TableCell>{result.person.name}</TableCell>
                {!isMobileView() &&
                    Array.from({ length: maxAttempts }, (_, i) => (
                        <TableCell key={i}>
                            {submittedAttempts.length > i
                                ? attemptWithPenaltyToString(
                                      submittedAttempts[i]
                                  )
                                : ""}
                        </TableCell>
                    ))}
                <TableCell>{result.averageString}</TableCell>
                <TableCell>{result.bestString}</TableCell>
            </TableRow>
        </>
    );
};

export default PublicResultRow;
