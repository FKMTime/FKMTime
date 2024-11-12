import {
    Box,
    Table,
    TableContainer,
    Tbody,
    Td,
    Th,
    Thead,
    Tr,
    useToast,
} from "@chakra-ui/react";

import AttemptResultInput from "@/Components/AttemptResultInput";
import AttemptWarnings from "@/Components/AttemptWarnings";
import PenaltySelect from "@/Components/PenaltySelect";
import { DNF_VALUE } from "@/logic/constants";
import {
    Attempt,
    AttemptType,
    Competition,
    ResultToDoubleCheck,
} from "@/logic/interfaces";
import { attemptWithPenaltyToString } from "@/logic/resultFormatters";
import { checkTimeLimit } from "@/logic/results";
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
                    <Thead>
                        <Tr>
                            <Th
                                display={{
                                    base: "none",
                                    md: "table-cell",
                                }}
                                color="white"
                            >
                                Attempt
                            </Th>
                            <Th color="white">Time</Th>
                            <Th color="white">Penalty</Th>
                            <Th color="white">Result</Th>
                            <Th
                                display={{
                                    base: "none",
                                    md: "table-cell",
                                }}
                                color="white"
                            >
                                Warnings
                            </Th>
                        </Tr>
                    </Thead>
                    <Tbody>
                        {submittedAttempts.map((attempt) => (
                            <Tr key={attempt.id}>
                                <Td
                                    display={{
                                        base: "none",
                                        md: "table-cell",
                                    }}
                                >
                                    {attempt.type === AttemptType.EXTRA_ATTEMPT
                                        ? `E${attempt.attemptNumber}`
                                        : attempt.attemptNumber}
                                </Td>
                                <Td>
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
                                                    status: "error",
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
                                </Td>
                                <Td>
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
                                </Td>
                                <Td>{attemptWithPenaltyToString(attempt)}</Td>
                                <Td
                                    display={{
                                        base: "none",
                                        md: "table-cell",
                                    }}
                                >
                                    <Box display="flex" gap={1}>
                                        <AttemptWarnings attempt={attempt} />
                                    </Box>
                                </Td>
                            </Tr>
                        ))}
                    </Tbody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default AttemptsList;
