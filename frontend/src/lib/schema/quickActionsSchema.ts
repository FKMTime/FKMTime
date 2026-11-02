import { z } from "zod";

import { limitedText } from "./fields";

export const quickActionSchema = z.object({
    name: limitedText("Name", 2, 50),
    comment: limitedText("Comment", 2, 50),
    giveExtra: z.boolean(),
    isShared: z.boolean(),
});
