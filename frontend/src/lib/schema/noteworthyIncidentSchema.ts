import { z } from "zod";

export const noteworthyIncidentSchema = z.object({
    title: z.string().nonempty(),
    description: z.string().optional(),
});
