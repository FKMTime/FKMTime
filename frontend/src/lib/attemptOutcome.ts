import { AttemptStatus } from "./interfaces";

/**
 * What happened to an attempt, in the words the attempt form uses. "open",
 * "scrambled" and "voided" only appear when editing an attempt already in
 * that state.
 */
export type AttemptOutcome =
    | "counts"
    | "extra"
    | "open"
    | "scrambled"
    | "voided";

export const outcomeFromStatus = (status: AttemptStatus): AttemptOutcome => {
    switch (status) {
        case AttemptStatus.EXTRA_GIVEN:
            return "extra";
        case AttemptStatus.UNRESOLVED:
            return "open";
        case AttemptStatus.SCRAMBLED:
            return "scrambled";
        case AttemptStatus.VOIDED:
            return "voided";
        default:
            return "counts";
    }
};

/**
 * The stored status for a chosen outcome. An attempt that was an incident
 * and now counts becomes "resolved", so its history stays visible.
 */
export const statusFromOutcome = (
    outcome: AttemptOutcome,
    originalStatus?: AttemptStatus
): AttemptStatus => {
    switch (outcome) {
        case "extra":
            return AttemptStatus.EXTRA_GIVEN;
        case "open":
            return AttemptStatus.UNRESOLVED;
        case "scrambled":
            return AttemptStatus.SCRAMBLED;
        case "voided":
            return AttemptStatus.VOIDED;
        default:
            return originalStatus === AttemptStatus.UNRESOLVED ||
                originalStatus === AttemptStatus.RESOLVED
                ? AttemptStatus.RESOLVED
                : AttemptStatus.STANDARD;
    }
};
