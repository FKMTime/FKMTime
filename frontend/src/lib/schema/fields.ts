import { z } from "zod";

/** Text that can't be left empty, with the same message for missing and "" */
export const requiredText = (message: string) =>
    z.string({ error: message }).nonempty(message);

/** Text with a length limit, whose messages name the field as the form does */
export const limitedText = (label: string, min: number, max: number) =>
    z
        .string({ error: `${label} is required` })
        .min(min, `${label} must be at least ${min} characters`)
        .max(max, `${label} can be at most ${max} characters`);
