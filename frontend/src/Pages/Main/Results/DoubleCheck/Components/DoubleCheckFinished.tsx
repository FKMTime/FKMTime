import { Alert, AlertDescription, AlertTitle } from "@/Components/ui/alert";
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
        <Alert>
            <AlertTitle>Well done!</AlertTitle>
            <AlertDescription>
                All {totalResults} scorecards for {activityCodeToName(roundId)}{" "}
                have been double-checked.
            </AlertDescription>
        </Alert>
    );
};

export default DoubleCheckFinished;
