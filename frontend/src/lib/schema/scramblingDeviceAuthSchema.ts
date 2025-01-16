import { z } from "zod";

export const scramblingDeviceLoginSchema = z.object({
    code: z
        .string()
        .min(6, {
            message: "Your one-time code must be 6 characters.",
        })
        .default(""),
});
