import { Lock, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/Components/ui/alert";
import { Button } from "@/Components/ui/button";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName } from "@/lib/activities";
import {
    integratedLiveBlockersQuery,
    integratedLiveRoundsQuery,
    invalidateIntegratedLiveRounds,
    openIntegratedLiveRound,
} from "@/lib/integratedLive";
import { IntegratedLiveRound } from "@/lib/interfaces";

interface IntegratedLiveRoundsToOpenProps {
    /** The rounds running in a room right now */
    roundIds: string[];
}

const isFirstRound = (roundId: string) => roundId.endsWith("-r1");
const previousRoundId = (roundId: string) => {
    const [eventId, number] = roundId.split("-r");
    return `${eventId}-r${Number(number) - 1}`;
};

const RoundToOpen = ({ round }: { round: IntegratedLiveRound }) => {
    const { toast } = useToast();
    const [isOpening, setIsOpening] = useState(false);
    const isReady = round.state === "ready";
    const { data: blockers } = useLiveQuery(
        integratedLiveBlockersQuery(round.roundId),
        { enabled: isReady && !isFirstRound(round.roundId) }
    );
    const name = activityCodeToName(round.roundId);

    const open = async () => {
        setIsOpening(true);
        const { ok, message } = await openIntegratedLiveRound(round.roundId);
        setIsOpening(false);
        toast(
            ok
                ? { title: `${name} opened`, variant: "success" }
                : {
                      title: `Couldn't open ${name}`,
                      description: message,
                      variant: "destructive",
                  }
        );
        void invalidateIntegratedLiveRounds();
    };

    const reasons =
        round.state === "pending"
            ? ["The WCA is waiting for the previous round to be complete"]
            : round.state === "blocked"
              ? [
                    `Too few competitors for this round (regulation 9m)${round.competitorCountNeeded ? `: needs ${round.competitorCountNeeded}` : ""}`,
                ]
              : blockers ?? [];

    return (
        <Alert variant="warning">
            <TriangleAlert />
            <AlertTitle>
                {name} isn't open in WCA Integrated Live Results
            </AlertTitle>
            <AlertDescription className="space-y-2">
                {!isFirstRound(round.roundId) && isReady && (
                    <p>
                        Opening it locks{" "}
                        {activityCodeToName(previousRoundId(round.roundId))}:
                        corrections there will no longer change who advances.
                    </p>
                )}
                {reasons.length > 0 && (
                    <ul className="list-disc pl-5">
                        {reasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                        ))}
                    </ul>
                )}
                <p>Its results wait, and are sent once it's open.</p>
                {isReady && (
                    <Button size="sm" onClick={open} disabled={isOpening}>
                        <Lock />
                        {reasons.length > 0 ? "Open anyway" : `Open ${name}`}
                    </Button>
                )}
            </AlertDescription>
        </Alert>
    );
};

/**
 * Rounds in progress that WCA Integrated Live Results hasn't opened yet:
 * results can't reach the WCA until someone opens them (SPEC-006 section 4)
 */
const IntegratedLiveRoundsToOpen = ({
    roundIds,
}: IntegratedLiveRoundsToOpenProps) => {
    const { data: rounds } = useLiveQuery(integratedLiveRoundsQuery);
    const toOpen = (rounds ?? []).filter(
        (round) =>
            roundIds.includes(round.roundId) &&
            ["ready", "pending", "blocked"].includes(round.state)
    );
    if (toOpen.length === 0) return null;
    return (
        <>
            {toOpen.map((round) => (
                <RoundToOpen key={round.roundId} round={round} />
            ))}
        </>
    );
};

export default IntegratedLiveRoundsToOpen;
