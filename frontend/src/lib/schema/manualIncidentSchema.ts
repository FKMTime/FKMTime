import { z } from "zod";

import { requiredText } from "./fields";

export const manualIncidentSchema = z.object({
    eventId: z.string().optional(),
    personId: requiredText("Please select a competitor"),
    roundId: requiredText("Please select a round"),
    description: requiredText("Description is required"),
    attempt: z.string().optional(),
});
