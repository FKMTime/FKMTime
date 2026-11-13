import { useAtomValue } from "jotai";
import { useMemo } from "react";

import { useLiveQuery } from "@/hooks/useLiveQuery";
import { competitionAtom } from "@/lib/atoms";
import {
    INTEGRATED_LIVE_REFRESH,
    integratedLiveRoundDetailsQuery,
    integratedLiveRoundsQuery,
} from "@/lib/integratedLive";
import { IntegratedLiveResultView } from "@/lib/interfaces";
import { isOrganizerOrDelegate } from "@/lib/permissions";

/**
 * Whether the panel shows WCA Integrated Live Results: results go there, the
 * competition is connected, and the user may run rounds (SPEC-006 section 5)
 */
export const useIntegratedLiveEnabled = () => {
    const competition = useAtomValue(competitionAtom);
    return (
        isOrganizerOrDelegate() &&
        competition?.officialResultsDestination === "WCA_INTEGRATED_LIVE" &&
        competition.integratedLiveConnection === "CONNECTED"
    );
};

/** Every round's WCA state, for the round strip */
export const useIntegratedLiveRounds = () => {
    const enabled = useIntegratedLiveEnabled();
    const { data } = useLiveQuery(integratedLiveRoundsQuery, {
        enabled,
        refetchInterval: enabled ? INTEGRATED_LIVE_REFRESH : undefined,
    });
    return enabled ? data : undefined;
};

/**
 * One round as the WCA has it, refreshed every 10 seconds while on screen.
 * Undefined while it doesn't apply or loads.
 */
export const useIntegratedLiveRound = (roundId: string | undefined) => {
    const enabled = useIntegratedLiveEnabled() && !!roundId;
    const { data } = useLiveQuery(
        integratedLiveRoundDetailsQuery(roundId ?? ""),
        {
            enabled,
            refetchInterval: enabled ? INTEGRATED_LIVE_REFRESH : undefined,
        }
    );
    const details = enabled ? data ?? undefined : undefined;
    const byResultId = useMemo(
        () =>
            new Map<string, IntegratedLiveResultView>(
                (details?.results ?? []).map((r) => [r.resultId, r])
            ),
        [details]
    );
    return { details, byResultId };
};
