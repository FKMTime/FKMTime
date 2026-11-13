import { UserMinus } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/Components/ui/alert";
import { Button } from "@/Components/ui/button";
import { Checkbox } from "@/Components/ui/checkbox";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName } from "@/lib/activities";
import {
    integratedLiveNoShowsQuery,
    invalidateIntegratedLiveRounds,
    removeNoShows,
} from "@/lib/integratedLive";
import { IntegratedLiveNoShows } from "@/lib/interfaces";

const RoundNoShows = ({ round }: { round: IntegratedLiveNoShows }) => {
    const { toast } = useToast();
    // A proposal: everyone ticked, untick anyone allowed to compete late
    const [ticked, setTicked] = useState(
        () => new Set(round.competitors.map((c) => c.registrationId))
    );
    const [isRemoving, setIsRemoving] = useState(false);
    const name = activityCodeToName(round.roundId);
    const count = round.competitors.length;

    const toggle = (registrationId: number) =>
        setTicked((previous) => {
            const next = new Set(previous);
            if (next.has(registrationId)) next.delete(registrationId);
            else next.add(registrationId);
            return next;
        });

    const remove = async () => {
        setIsRemoving(true);
        const { ok, message } = await removeNoShows(round.roundId, [...ticked]);
        setIsRemoving(false);
        toast(
            ok
                ? { title: message, variant: "success" }
                : {
                      title: `Couldn't remove them from ${name}`,
                      description: message,
                      variant: "destructive",
                  }
        );
        void invalidateIntegratedLiveRounds();
    };

    return (
        <Alert variant="warning">
            <UserMinus />
            <AlertTitle>
                {count} {count === 1 ? "competitor" : "competitors"} didn't come
                to {name}
            </AlertTitle>
            <AlertDescription className="space-y-2">
                <p>
                    Until they're removed, WCA Integrated Live Results keeps the
                    next round from opening. Nobody moves up in their place: the
                    round is over.
                </p>
                <ul className="space-y-1">
                    {round.competitors.map((competitor) => (
                        <li key={competitor.registrationId}>
                            <label className="flex items-center gap-2">
                                <Checkbox
                                    checked={ticked.has(
                                        competitor.registrationId
                                    )}
                                    onCheckedChange={() =>
                                        toggle(competitor.registrationId)
                                    }
                                />
                                {competitor.name}
                            </label>
                        </li>
                    ))}
                </ul>
                <Button
                    size="sm"
                    onClick={remove}
                    disabled={ticked.size === 0 || isRemoving}
                >
                    Remove from {name} in WCA Integrated Live Results
                </Button>
            </AlertDescription>
        </Alert>
    );
};

/** Finished rounds with competitors who never came (SPEC-006 section 4) */
const NoShowsToRemove = () => {
    const { data: rounds } = useLiveQuery(integratedLiveNoShowsQuery);
    if (!rounds || rounds.length === 0) return null;
    return (
        <>
            {rounds.map((round) => (
                <RoundNoShows key={round.roundId} round={round} />
            ))}
        </>
    );
};

export default NoShowsToRemove;
