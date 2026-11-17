import { z } from "zod";

import { SendingResultsFrequency } from "../interfaces";
import { deviceSettingsSchema } from "./deviceSchema";

export const competitionSchema = z.object({
    scoretakingToken: z.string().default(""),
    cubingContestsToken: z.string().optional().nullable().default(""),
    sendingResultsFrequency: z
        .enum(["AFTER_SOLVE", "NEVER", "EVERY_5_MINUTES"])
        .default(SendingResultsFrequency.AFTER_SOLVE),
    shouldChangeGroupsAutomatically: z.boolean().default(true),
    useFkmTimeDevices: z.boolean().default(false),
    openRoundsAutomatically: z.boolean().default(false),
});

/**
 * Setup → Competition edits both in one form, but they are saved by two
 * endpoints, each only when one of its fields changed
 */
export const competitionSettingsSchema = competitionSchema.extend(
    deviceSettingsSchema.shape
);

export type CompetitionSettingsInput = z.input<
    typeof competitionSettingsSchema
>;
export type CompetitionSettingsField = keyof CompetitionSettingsInput;

/** Saved by `PUT competition/settings/:id` */
export const COMPETITION_FIELDS = Object.keys(
    competitionSchema.shape
) as CompetitionSettingsField[];

/** Saved by `PUT competition/settings/:id/devices` */
export const DEVICE_FIELDS = Object.keys(
    deviceSettingsSchema.shape
) as CompetitionSettingsField[];
