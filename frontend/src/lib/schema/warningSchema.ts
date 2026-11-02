import { z } from "zod";

import { requiredText } from "./fields";

export const warningSchema = z.object({
    description: requiredText("Description is required"),
});
