import { Tr, Td } from "@chakra-ui/react";
import { Attempt } from "../../../logic/interfaces";
import { resultToString } from "../../../logic/resultFormatters";

interface AttemptRowProps {
    attempt: Attempt;
    showExtraColumns?: boolean;
}

const AttemptRow: React.FC<AttemptRowProps> = ({ attempt, showExtraColumns = false }): JSX.Element => {

    return (
        <>
            <Tr key={attempt.id}>
                <Td>{attempt.isExtraAttempt ? `Extra ${attempt.attemptNumber}` : attempt.attemptNumber}</Td>
                <Td>{attempt.penalty < 2 ? resultToString(attempt.value) : (`${resultToString(attempt.value)} + ${attempt.penalty} = ${resultToString((attempt.value + (attempt.penalty * 2000)))}`)}</Td>
                <Td>{attempt.isExtraAttempt && "Yes"}</Td>
                {showExtraColumns && (
                    <>
                        <Td>{attempt.replacedBy && `Extra ${attempt.replacedBy}`}</Td>
                        <Td>{attempt.isDelegate ? attempt.isResolved ? "Resolved" : "Not resolved" : null}</Td>
                    </>
                )}
                <Td>{`${attempt.judge.name} (${attempt.judge.registrantId})`} </Td>
                <Td>{attempt.station.name}</Td>
                <Td>{new Date(attempt.solvedAt).toLocaleString()}</Td>
                <Td>
                    Actions
                </Td>
            </Tr>
        </>
    )
};

export default AttemptRow;
