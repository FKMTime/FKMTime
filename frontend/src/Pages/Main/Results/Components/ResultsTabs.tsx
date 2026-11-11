import { useEffect } from "react";

import PageTabs from "@/Components/shared/PageTabs";
import { LIVE_MAX_AGE, prefetchQuery } from "@/lib/queryCache";
import { resultsChecksQuery, roundResultsQuery } from "@/lib/results";

interface ResultsTabsProps {
    value: "rounds" | "checks";
    roundId?: string;
}

const ResultsTabs = ({ value, roundId }: ResultsTabsProps) => {
    // Load the other tab for the same round, so switching doesn't wait
    useEffect(() => {
        // /results moves on to a round straight away; wait for it
        if (!roundId) return;
        const options = { maxAge: LIVE_MAX_AGE };
        if (value === "rounds") {
            prefetchQuery(resultsChecksQuery(roundId), options);
        } else {
            prefetchQuery(roundResultsQuery(roundId), options);
        }
    }, [value, roundId]);

    return (
        <PageTabs
            label="Results"
            value={value}
            tabs={[
                {
                    value: "rounds",
                    label: "Rounds",
                    to: roundId ? `/results/round/${roundId}` : "/results",
                },
                {
                    value: "checks",
                    label: "Checks",
                    to: roundId
                        ? `/results/checks/${roundId}`
                        : "/results/checks",
                },
            ]}
            className="max-md:-mt-4 max-md:bg-card"
        />
    );
};

export default ResultsTabs;
