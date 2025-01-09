import { TableCell, TableRow } from "@/Components/ui/table";
import { ResultWithAverage } from "@/lib/interfaces";
import { attemptWithPenaltyToString } from "@/lib/resultFormatters";
import { getSubmittedAttempts } from "@/lib/utils";

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
                {Array.from({ length: maxAttempts }, (_, i) => (
                    <TableCell key={i} className="hidden md:table-cell">
                        {submittedAttempts.length > i
                            ? attemptWithPenaltyToString(submittedAttempts[i])
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
