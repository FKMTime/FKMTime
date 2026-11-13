import { TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";

import { Alert, AlertDescription, AlertTitle } from "@/Components/ui/alert";
import { Competition } from "@/lib/interfaces";

interface IntegratedLiveConnectionAlertProps {
    competition: Competition;
}

/** Results can't reach the WCA's live results until someone connects */
const IntegratedLiveConnectionAlert = ({
    competition,
}: IntegratedLiveConnectionAlertProps) => {
    if (
        competition.officialResultsDestination !== "WCA_INTEGRATED_LIVE" ||
        competition.integratedLiveConnection === "CONNECTED"
    ) {
        return null;
    }
    const isBroken = competition.integratedLiveConnection === "BROKEN";
    return (
        <Alert variant="warning">
            <TriangleAlert />
            <AlertTitle>
                {isBroken
                    ? "WCA Integrated Live Results disconnected"
                    : "Not connected to WCA Integrated Live Results"}
            </AlertTitle>
            <AlertDescription>
                <Link className="font-semibold underline" to="/competition">
                    {isBroken ? "Reconnect" : "Connect"} in settings
                </Link>{" "}
                to send results to the WCA website.
            </AlertDescription>
        </Alert>
    );
};

export default IntegratedLiveConnectionAlert;
