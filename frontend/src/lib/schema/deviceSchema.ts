import { z } from "zod";

import { BUZZER_VOLUME_MAX, BUZZER_VOLUME_MIN } from "@/lib/constants";

import { requiredText } from "./fields";

export const deviceSchema = z.object({
    name: requiredText("Name is required"),
    espId: z
        .string()
        .regex(
            /^[0-9a-fA-F]*$/,
            "ESP ID can only use digits 0-9 and letters A-F"
        )
        .optional(),
    roomId: requiredText("Please select a room"),
    type: z.enum(["STATION", "ATTENDANCE_SCRAMBLER", "ATTENDANCE_RUNNER"], {
        error: "Please select a device type",
    }),
    hwVersion: z.enum(["V3", "V4"], {
        error: "Please select a hardware version",
    }),
});

export const deviceSettingsSchema = z.object({
    shouldUpdateDevices: z.boolean(),
    mdns: z.boolean(),
    wsUrl: z.string().optional(),
    wifiSsid: z.string().optional(),
    wifiPassword: z.string().optional(),
    defaultLocale: z.string().default("en"),
    hilTesting: z.boolean(),
    secureRfid: z.boolean(),
    soundEnabled: z.boolean(),
    buzzerVolume: z
        .number()
        .int()
        .min(BUZZER_VOLUME_MIN)
        .max(BUZZER_VOLUME_MAX),
});
