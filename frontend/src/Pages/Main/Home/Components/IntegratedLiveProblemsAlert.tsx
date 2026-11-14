import { TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";

import { Alert, AlertDescription, AlertTitle } from "@/Components/ui/alert";
import { useIntegratedLiveEnabled } from "@/hooks/useIntegratedLiveRound";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { activityCodeToName } from "@/lib/activities";
import { integratedLiveProblemsQuery } from "@/lib/integratedLive";

/** How often Home checks for results that aren't getting through */
const PROBLEMS_REFRESH = 30_000;

const plural = (count: number, one: string, many: string) =>
    `${count} ${count === 1 ? one : many}`;

/**
 * One alert above the rooms when results aren't reaching WCA Integrated
 * Live Results: stuck on their way for minutes, or refused. Each round links
 * to its results, where every result says why (SPEC-006 section 5). A
 * broken connection has its own alert.
 */
const IntegratedLiveProblemsAlert = () => {
    const enabled = useIntegratedLiveEnabled();
    const { data } = useLiveQuery(integratedLiveProblemsQuery, {
        enabled,
        refetchInterval: enabled ? PROBLEMS_REFRESH : undefined,
    });
    if (!enabled || !data) return null;

    const rounds = new Map<string, { stuck: number; refused: number }>();
    for (const { roundId, count } of data.stuck) {
        rounds.set(roundId, { stuck: count, refused: 0 });
    }
    for (const { roundId, count } of data.refused) {
        rounds.set(roundId, {
            stuck: rounds.get(roundId)?.stuck ?? 0,
            refused: count,
        });
    }
    if (rounds.size === 0) return null;

    return (
        <Alert variant="warning">
            <TriangleAlert />
            <AlertTitle>
                Some results aren't reaching WCA live results
            </AlertTitle>
            <AlertDescription>
                <ul className="flex flex-col gap-0.5">
                    {[...rounds].map(([roundId, { stuck, refused }]) => (
                        <li key={roundId}>
                            <Link
                                className="font-semibold underline"
                                to={`/results/round/${roundId}`}
                            >
                                {activityCodeToName(roundId)}
                            </Link>
                            :{" "}
                            {[
                                stuck > 0 &&
                                    `${plural(stuck, "result", "results")} still sending after a few minutes`,
                                refused > 0 &&
                                    `${plural(refused, "result", "results")} not taken`,
                            ]
                                .filter(Boolean)
                                .join(", ")}
                        </li>
                    ))}
                </ul>
            </AlertDescription>
        </Alert>
    );
};

export default IntegratedLiveProblemsAlert;
