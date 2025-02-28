import { z } from "zod";

export const warningSchema = z.object({
    description: z.string().nonempty("Description is required"),
});
