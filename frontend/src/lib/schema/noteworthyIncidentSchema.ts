import { z } from "zod";

import { requiredText } from "./fields";

export const noteworthyIncidentSchema = z.object({
    title: requiredText("Title is required"),
    description: z.string().optional(),
});
