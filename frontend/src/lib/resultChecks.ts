import { DNS_VALUE } from "./constants";
import { Attempt } from "./interfaces";

export type CheckType = "inspection" | "penalty" | "dns" | "fast" | "staffing";

export const CHECK_TYPE_LABELS: Record<CheckType, string> = {
    inspection: "Inspection",
    penalty: "Penalty",
    dns: "DNS",
    fast: "Fast",
    staffing: "Staffing",
};

/** Why an attempt shows up in results checks; mirrors AttemptWarnings */
export const getCheckTypes = (attempt: Attempt): CheckType[] => {
    const types: CheckType[] = [];
    if (attempt.inspectionTime && attempt.inspectionTime > 15000)
        types.push("inspection");
    if (attempt.penalty > 2) types.push("penalty");
    if (attempt.penalty === DNS_VALUE) types.push("dns");
    if (attempt.fastAttemptRatio !== undefined) types.push("fast");
    if (attempt.staffingWarnings?.length) types.push("staffing");
    return types;
};
