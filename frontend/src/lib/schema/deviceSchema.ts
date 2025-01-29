import { z } from "zod";

export const deviceSchema = z.object({
    name: z.string().nonempty(),
    espId: z.string(),
    roomId: z.string().nonempty({
        message: "Please select a room",
    }),
    type: z.enum(["STATION", "ATTENDANCE_SCRAMBLER", "ATTENDANCE_RUNNER"]),
});

export const deviceSettingsSchema = z.object({
    shouldUpdateDevices: z.boolean(),
    mdns: z.boolean(),
    ipAddress: z.string().optional(),
    port: z.number().optional(),
    secure: z.boolean().optional(),
    wifiSsid: z.string().optional(),
    wifiPassword: z.string().optional(),
});
