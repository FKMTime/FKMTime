import { z } from "zod";

import { requiredText } from "./fields";

export const scramblingDeviceSchema = z.object({
    name: requiredText("Name is required"),
    roomId: requiredText("Please select a room"),
});
