import { z } from "zod";

export const quickActionSchema = z.object({
    name: z.string().min(2).max(50),
    comment: z.string().min(2).max(50),
    giveExtra: z.boolean(),
    isShared: z.boolean(),
});
