import { FaList } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";

import DeleteButton from "@/Components/DeleteButton";
import SmallIconButton from "@/Components/SmallIconButton";
import { TableCell, TableRow } from "@/Components/ui/table";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import { isAdmin } from "@/lib/auth";
import { average, formattedBest } from "@/lib/average";
import { Result } from "@/lib/interfaces";
import {
    attemptWithPenaltyToString,
    resultToString,
} from "@/lib/resultFormatters";
import { deleteResultById } from "@/lib/results";
import { getSubmittedAttempts } from "@/lib/utils";

interface ResultRowProps {
    result: Result;
    maxAttempts: number;
    fetchData: (roundId: string, searchParam?: string) => void;
}

const ResultRow = ({ result, maxAttempts, fetchData }: ResultRowProps) => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const confirm = useConfirm();

    const submittedAttempts = getSubmittedAttempts(result.attempts);
    const calculatedAverage =
        submittedAttempts.length === maxAttempts && average(submittedAttempts);

    const handleDelete = async () => {
        confirm({
            title: "Delete result",
            description:
                "Are you sure you want to delete this result? This action cannot be undone",
        })
            .then(async () => {
                const status = await deleteResultById(result.id);
                if (status === 204) {
                    toast({
                        title: "Successfully deleted result.",
                        variant: "success",
                    });
                    fetchData(result.roundId);
                } else {
                    toast({
                        title: "Error",
                        description: "Something went wrong",
                        variant: "destructive",
                    });
                }
            })
            .catch(() => {
                toast({
                    title: "Cancelled",
                    description:
                        "You have cancelled the deletion of the result.",
                });
            });
    };

    return (
        <>
            <TableRow key={result.id}>
                <TableCell>
                    <Link to={`/results/${result.id}`}>
                        {result.person.name}{" "}
                        {result.person.registrantId &&
                            `(${result.person.registrantId})`}
                    </Link>
                </TableCell>
                {Array.from({ length: maxAttempts }, (_, i) => (
                    <TableCell key={i} className="hidden md:table-cell">
                        {submittedAttempts.length > i
                            ? attemptWithPenaltyToString(submittedAttempts[i])
                            : ""}
                    </TableCell>
                ))}
                <TableCell className="hidden md:table-cell">
                    {calculatedAverage ? resultToString(calculatedAverage) : ""}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                    {formattedBest(submittedAttempts)}
                </TableCell>
                {isAdmin() && (
                    <TableCell>
                        <SmallIconButton
                            icon={<FaList />}
                            title="View attempts"
                            onClick={() => navigate(`/results/${result.id}`)}
                        />
                        <DeleteButton onClick={handleDelete} />
                    </TableCell>
                )}
            </TableRow>
        </>
    );
};

export default ResultRow;
