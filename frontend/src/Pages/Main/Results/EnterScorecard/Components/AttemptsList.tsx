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
import { getEventIdFromRoundId } from "@/lib/activities";
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
    /** Enter on the last time saves, with that attempt as just typed */
    onSubmit: (lastAttempt: AttemptToEnterWithScorecard) => void;
}

const AttemptsList: React.FC<AttemptsListProps> = ({
    attempts,
    competition,
    roundId,
    onChange,
    onSubmit,
}) => {
    // A time over the limit is a DNF
    const withValue = (
        attempt: AttemptToEnterWithScorecard,
        value: number
    ) => ({
        ...attempt,
        value,
        penalty: checkTimeLimit(value, competition.wcif, roundId)
            ? attempt.penalty
            : DNF_VALUE,
    });

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
                    {attempts.map((attempt, index) => (
                        <TableRow key={attempt.id}>
                            <TableCell>
                                {attempt.type === AttemptType.EXTRA_ATTEMPT
                                    ? `E${attempt.attemptNumber}`
                                    : attempt.attemptNumber}
                            </TableCell>
                            <TableCell>
                                <AttemptResultInput
                                    value={attempt.value}
                                    aria-label={`Attempt ${attempt.attemptNumber} time`}
                                    onPenaltyShortcut={(penalty) =>
                                        onChange({ ...attempt, penalty })
                                    }
                                    onChange={(value) =>
                                        onChange(withValue(attempt, value))
                                    }
                                    onEnter={
                                        index === attempts.length - 1
                                            ? (value) =>
                                                  onSubmit(
                                                      withValue(attempt, value)
                                                  )
                                            : undefined
                                    }
                                />
                            </TableCell>

                            <TableCell>
                                <PenaltySelect
                                    value={attempt.penalty}
                                    eventId={getEventIdFromRoundId(roundId)}
                                    onChange={(penalty) =>
                                        onChange({ ...attempt, penalty })
                                    }
                                    // Tab goes from time to time; D and S
                                    // set DNF and DNS from the time field
                                    tabIndex={-1}
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
