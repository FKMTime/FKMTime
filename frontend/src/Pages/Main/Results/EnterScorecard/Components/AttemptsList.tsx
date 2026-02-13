import AttemptResultInput from "@/Components/AttemptResultInput";
import PenaltySelect from "@/Components/PenaltySelect";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { DNF_VALUE } from "@/lib/constants";
import {
    AttemptToEnterWithScorecard,
    AttemptType,
    Competition,
} from "@/lib/interfaces";
import { attemptWithPenaltyToString } from "@/lib/resultFormatters";
import { checkTimeLimit } from "@/lib/results";

interface AttemptsListProps {
    attempts: AttemptToEnterWithScorecard[];
    competition: Competition;
    roundId: string;
    onChange: (attempt: AttemptToEnterWithScorecard) => void;
}

const AttemptsList: React.FC<AttemptsListProps> = ({
    attempts,
    competition,
    roundId,
    onChange,
}) => {
    return (
        <div className="flex flex-col gap-5">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead color="white">Attempt</TableHead>
                        <TableHead
                            color="white"
                            className="hidden md:table-cell"
                        >
                            Time
                        </TableHead>
                        <TableHead
                            color="white"
                            className="hidden md:table-cell"
                        >
                            Penalty
                        </TableHead>
                        <TableHead color="white" className="font-bold">
                            Result
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {attempts.map((attempt) => (
                        <TableRow key={attempt.id}>
                            <TableCell>
                                {attempt.type === AttemptType.EXTRA_ATTEMPT
                                    ? `E${attempt.attemptNumber}`
                                    : attempt.attemptNumber}
                            </TableCell>
                            <TableCell>
                                <AttemptResultInput
                                    value={attempt.value}
                                    onChange={(value) => {
                                        const passed = checkTimeLimit(
                                            value,
                                            competition.wcif,
                                            roundId
                                        );

                                        onChange({
                                            ...attempt,
                                            value,
                                            penalty: passed
                                                ? attempt.penalty
                                                : DNF_VALUE,
                                        });
                                    }}
                                />
                            </TableCell>

                            <TableCell>
                                <PenaltySelect
                                    value={attempt.penalty}
                                    onChange={(penalty) =>
                                        onChange({ ...attempt, penalty })
                                    }
                                    shortVersion
                                />
                            </TableCell>

                            <TableCell className="font-bold">
                                {attemptWithPenaltyToString(attempt)}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};

export default AttemptsList;
