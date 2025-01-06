import {
    Box,
    Table,
    TableContainer,
    Tbody,
    Td,
    Th,
    TableHead,
    Tr,
    useToast,
} from "@chakra-ui/react";

import AttemptResultInput from "@/Components/AttemptResultInput";
import AttemptWarnings from "@/Components/AttemptWarnings";
import PenaltySelect from "@/Components/PenaltySelect";
import { DNF_VALUE } from "@/lib/constants";
import {
    Attempt,
    AttemptType,
    Competition,
    ResultToDoubleCheck,
} from "@/lib/interfaces";
import { attemptWithPenaltyToString } from "@/lib/resultFormatters";
import { checkTimeLimit } from "@/lib/results";
import { getSubmittedAttempts } from "@/logic/utils";

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
    const toast = useToast();
    const submittedAttempts = getSubmittedAttempts(result.attempts);

    return (
        <Box display="flex" flexDirection="column" gap={5}>
            <TableContainer>
                <Table>
                    <TableHead>
                        <TableRow>
                            <Th
                                display={{
                                    base: "none",
                                    md: "table-cell",
                                }}
                                color="white"
                            >
                                Attempt
                            </TableHead>
                            <Th color="white">Time</TableHead>
                            <Th color="white">Penalty</TableHead>
                            <Th color="white">Result</TableHead>
                            <Th
                                display={{
                                    base: "none",
                                    md: "table-cell",
                                }}
                                color="white"
                            >
                                Warnings
                            </TableHead>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {submittedAttempts.map((attempt) => (
                            <TableRow key={attempt.id}>
                                <TableCell
                                    display={{
                                        base: "none",
                                        md: "table-cell",
                                    }}
                                >
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
                                            const isLimitPassed =
                                                checkTimeLimit(
                                                    newValue,
                                                    competition?.wcif,
                                                    result.roundId
                                                );
                                            if (!isLimitPassed) {
                                                toast({
                                                    title: "This attempt is over the time limit.",
                                                    description:
                                                        "This time is DNF.",
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
                                        showLabel={false}
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
                                <TableCell>{attemptWithPenaltyToString(attempt)}</TableCell>
                                <TableCell
                                    display={{
                                        base: "none",
                                        md: "table-cell",
                                    }}
                                >
                                    <Box display="flex" gap={1}>
                                        <AttemptWarnings attempt={attempt} />
                                    </Box>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default AttemptsList;
