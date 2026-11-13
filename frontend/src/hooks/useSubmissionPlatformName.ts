import { useAtomValue } from "jotai";
import { useCallback } from "react";

import { competitionAtom } from "@/lib/atoms";
import { getSubmissionPlatformName } from "@/lib/utils";

/** Where an event's results are sent, or null when they go nowhere */
export const useSubmissionPlatformName = () => {
    const destination =
        useAtomValue(competitionAtom)?.officialResultsDestination;
    return useCallback(
        (eventId: string) => getSubmissionPlatformName(eventId, destination),
        [destination]
    );
};
