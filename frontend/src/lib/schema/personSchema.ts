import { z } from "zod";

import { limitedText } from "./fields";

export const addPersonSchema = z.object({
    name: limitedText("Name", 2, 50),
    gender: z.enum(["m", "f", "o"], { error: "Please select a gender" }),
    wcaId: z.string().max(10, "WCA ID can be at most 10 characters").optional(),
    countryIso2: z.string().length(2, "Please select a country").optional(),
    cardId: z.string().max(20, "Card can be at most 20 characters").optional(),
});
