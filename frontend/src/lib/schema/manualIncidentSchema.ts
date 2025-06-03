import { z } from "zod";

export const manualIncidentSchema = z.object({
    eventId: z.string().optional(),
    personId: z.string().nonempty(),
    roundId: z.string().nonempty(),
    description: z.string().nonempty(),
    attempt: z.string().optional(),
});
