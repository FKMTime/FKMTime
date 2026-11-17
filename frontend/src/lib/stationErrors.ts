import { StationLastError } from "@/lib/interfaces";

/** The backend drops an error after this long too (SPEC-010) */
export const STATION_ERROR_TTL_MS = 10 * 60_000;

const ASSIGN_CARD =
    "Card {cardId} isn't assigned. Assign it on the Cards page.";

/** What the delegate should do, by the station text's key */
const HINTS: Record<string, string> = {
    competitionNotFound: "Import the competition.",
    noGroups:
        "Start a group in the station's room, or point the station at a round.",
    groupNotFound:
        "Ask the competitor to scan their card again and choose the round.",
    stationRoundChanged:
        "The solve was not saved. Enter it by hand in Results, or give an extra.",
    competitorNotFound: ASSIGN_CARD,
    judgeNotFound: ASSIGN_CARD,
    judgeIsCompetitor: "Another person has to scan their card as the judge.",
    judgeCardNotScanned: "The judge has to scan their card to enter the redo.",
    competitorIsNotSignedInForEvent:
        "Check that the competitor is at the right station, or fix their registration.",
    internalError:
        "Something failed on the server. Try again, and check the backend logs if it happens again.",
    attemptAlreadyEntered:
        "Already saved. If the time differs from the station's, check the attempt in Results.",
    competitorRemovedFromRound:
        "Restore them in Results if that was a mistake.",
    cutoffNotPassed: "Nothing to fix: the cutoff was not met.",
    noAttemptsLeft: "Grant an extra attempt if the competitor is owed one.",
};

/** The hint for an error, or null for a key this panel doesn't know yet */
export const stationErrorHint = (lastError: StationLastError) => {
    const hint = HINTS[lastError.key];
    if (!hint) return null;
    return hint.replace("{cardId}", lastError.cardId ?? "");
};
