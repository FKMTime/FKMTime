import { Badge } from "@chakra-ui/react";

import { Attempt } from "@/logic/interfaces";

interface AttemptsWarningProps {
    attempt: Attempt;
}

const AttemptWarnings = ({ attempt }: AttemptsWarningProps) => {
    return (
        <>
            {attempt.inspectionTime && attempt.inspectionTime > 15000 && (
                <Badge colorScheme="red" borderRadius="md" p="1">
                    Inspection time exceeded
                </Badge>
            )}
            {attempt.penalty > 2 && (
                <Badge colorScheme="red" borderRadius="md" p="1">
                    +{attempt.penalty}
                </Badge>
            )}
        </>
    );
};

export default AttemptWarnings;
