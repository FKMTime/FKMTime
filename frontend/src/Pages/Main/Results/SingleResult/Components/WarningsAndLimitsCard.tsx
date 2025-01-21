import { TimeLimit } from "@wca/helpers";
import { AlertCircle } from "lucide-react";
import { useMemo } from "react";
import { getCutoffByRoundId } from "wcif-helpers";

import { Alert, AlertTitle } from "@/Components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { activityCodeToName } from "@/lib/activities";
import { isUnofficialEvent } from "@/lib/events";
import { Attempt, Competition, Result } from "@/lib/interfaces";
import { isThereADifferenceBetweenResults } from "@/lib/utils";

import RoundLimits from "../../Components/RoundLimits";

interface WarningsAndLimitsCardProps {
    competition: Competition;
    result: Result;
    submittedAttempts: Attempt[];
    limit: TimeLimit | null;
    maxAttempts: number;
}

const WarningsAndLimitsCard = ({
    competition,
    result,
    submittedAttempts,
    limit,
    maxAttempts,
}: WarningsAndLimitsCardProps) => {
    const isDifferenceBetweenResults = useMemo(() => {
        if (!result || !competition) return false;
        return isThereADifferenceBetweenResults(
            result,
            submittedAttempts,
            competition.wcif
        );
    }, [competition, result, submittedAttempts]);

    const cutoff = useMemo(() => {
        if (!competition || !result) {
            return null;
        }
        return getCutoffByRoundId(result.roundId, competition.wcif);
    }, [competition, result]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>{activityCodeToName(result.roundId)}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                {!isDifferenceBetweenResults &&
                    !isUnofficialEvent(result.eventId) && (
                        <Alert
                            variant="destructive"
                            className="flex gap-2 items-center"
                        >
                            <div>
                                <AlertCircle />
                            </div>
                            <AlertTitle>
                                There is a difference between results in WCA
                                Live and FKMTime. Please check it manually, fix
                                in FKMTime and resubmit scorecard to WCA Live.
                            </AlertTitle>
                        </Alert>
                    )}
                <RoundLimits
                    cutoff={cutoff}
                    limit={limit}
                    maxAttempts={maxAttempts}
                    size={"lg"}
                />
            </CardContent>
        </Card>
    );
};

export default WarningsAndLimitsCard;
