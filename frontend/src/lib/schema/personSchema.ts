import { z } from "zod";

export const addPersonSchema = z.object({
    name: z.string().min(2).max(50),
    gender: z.enum(["m", "f", "o"]),
    wcaId: z.string().max(10).optional(),
    countryIso2: z.string().length(2).optional(),
    cardId: z.string().max(20).optional(),
});
