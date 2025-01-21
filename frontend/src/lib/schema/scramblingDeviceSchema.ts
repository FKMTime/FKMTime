import { z } from "zod";

export const scramblingDeviceSchema = z.object({
    name: z.string().nonempty(),
    roomId: z.string(),
});
