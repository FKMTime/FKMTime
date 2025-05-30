import { z } from "zod";

import { SendingResultsFrequency } from "../interfaces";

export const competitionSchema = z.object({
    scoretakingToken: z.string().default(""),
    cubingContestsToken: z.string().default(""),
    sendingResultsFrequency: z
        .enum(["AFTER_SOLVE", "NEVER", "EVERY_5_MINUTES"])
        .default(SendingResultsFrequency.AFTER_SOLVE),
    shouldChangeGroupsAutomatically: z.boolean().default(true),
    useFkmTimeDevices: z.boolean().default(false),
});
