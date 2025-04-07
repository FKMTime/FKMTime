import { z } from "zod";

export const createAttemptSchema = z.object({
    type: z.enum(["STANDARD_ATTEMPT", "EXTRA_ATTEMPT"]),
    status: z.enum([
        "STANDARD",
        "UNRESOLVED",
        "RESOLVED",
        "EXTRA_GIVEN",
        "SCRAMBLED",
    ]),
    competitorId: z.string(),
    judgeId: z.string().optional(),
    scramblerId: z.string().optional(),
    deviceId: z.string(),
    attemptNumber: z.number(),
    value: z.number(),
    penalty: z.number(),
    comment: z.string().nullable(),
    replacedBy: z.string().optional(),
});

export const giveExtraAttemptSchema = z.object({
    comment: z.string().nullable(),
});
