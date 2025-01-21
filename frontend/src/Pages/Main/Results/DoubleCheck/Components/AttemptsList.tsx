import AttemptResultInput from "@/Components/AttemptResultInput";
import AttemptWarnings from "@/Components/AttemptWarnings";
import PenaltySelect from "@/Components/PenaltySelect";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { useToast } from "@/hooks/useToast";
import { DNF_VALUE } from "@/lib/constants";
import {
    Attempt,
    AttemptType,
    Competition,
    ResultToDoubleCheck,
} from "@/lib/interfaces";
import { attemptWithPenaltyToString } from "@/lib/resultFormatters";
import { checkTimeLimit } from "@/lib/results";
import { getSubmittedAttempts } from "@/lib/utils";

interface AttemptsListProps {
    result: ResultToDoubleCheck;
    updateAttempt: (attempt: Attempt) => void;
    competition: Competition;
}

const AttemptsList: React.FC<AttemptsListProps> = ({
    result,
    competition,
    updateAttempt,
}) => {
    const { toast } = useToast();
    const submittedAttempts = getSubmittedAttempts(result.attempts);

    return (
        <div className="flex flex-col gap-5">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead
                            className="hidden md:table-cell"
                            color="white"
                        >
                            Attempt
                        </TableHead>
                        <TableHead color="white">Time</TableHead>
                        <TableHead color="white">Penalty</TableHead>
                        <TableHead color="white">Result</TableHead>
                        <TableHead
                            className="hidden md:table-cell"
                            color="white"
                        >
                            Warnings
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {submittedAttempts.map((attempt) => (
                        <TableRow key={attempt.id}>
                            <TableCell className="hidden md:table-cell">
                                {attempt.type === AttemptType.EXTRA_ATTEMPT
                                    ? `E${attempt.attemptNumber}`
                                    : attempt.attemptNumber}
                            </TableCell>
                            <TableCell>
                                <AttemptResultInput
                                    value={attempt.value}
                                    disabled={false}
                                    onChange={(newValue) => {
                                        if (!competition) {
                                            updateAttempt({
                                                ...attempt,
                                                value: newValue,
                                            });
                                            return;
                                        }
                                        const isLimitPassed = checkTimeLimit(
                                            newValue,
                                            competition?.wcif,
                                            result.roundId
                                        );
                                        if (!isLimitPassed) {
                                            toast({
                                                title: "TableHeadis attempt is over tableheade time limit.",
                                                description:
                                                    "TableHeadis time is DNF.",
                                                variant: "destructive",
                                            });
                                            updateAttempt({
                                                ...attempt,
                                                value: newValue,
                                                penalty: DNF_VALUE,
                                            });
                                            return;
                                        }
                                        updateAttempt({
                                            ...attempt,
                                            value: newValue,
                                        });
                                    }}
                                />
                            </TableCell>
                            <TableCell>
                                <PenaltySelect
                                    value={attempt.penalty}
                                    onChange={(value) =>
                                        updateAttempt({
                                            ...attempt,
                                            penalty: value,
                                        })
                                    }
                                    shortVersion
                                    disabled={false}
                                />
                            </TableCell>
                            <TableCell>
                                {attemptWithPenaltyToString(attempt)}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                                <div className="flex gap-1">
                                    <AttemptWarnings attempt={attempt} />
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};

export default AttemptsList;
