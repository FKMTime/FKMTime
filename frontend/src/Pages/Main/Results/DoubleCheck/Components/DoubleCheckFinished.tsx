import {
    Alert,
    AlertDescription,
    AlertIcon,
    AlertTitle,
} from "@chakra-ui/react";

import { activityCodeToName } from "@/lib/activities";

interface DoubleCheckFinishedProps {
    totalResults: number;
    roundId: string;
}

const DoubleCheckFinished = ({
    totalResults,
    roundId,
}: DoubleCheckFinishedProps) => {
    return (
        <Alert
            status="success"
            variant="subtle"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            color="black"
            textAlign="center"
            width="fit-content"
        >
            <AlertIcon boxSize="40px" mr={0} />
            <AlertTitle mt={4} mb={1} fontSize="lg">
                Well done!
            </AlertTitle>
            <AlertDescription maxWidth="sm">
                All {totalResults} scorecards for {activityCodeToName(roundId)}{" "}
                have been double-checked.
            </AlertDescription>
        </Alert>
    );
};

export default DoubleCheckFinished;
