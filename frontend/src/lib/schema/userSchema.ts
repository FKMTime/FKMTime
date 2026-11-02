import { z } from "zod";

import { limitedText, requiredText } from "./fields";

export const createFKMUserSchema = z.object({
    username: limitedText("Username", 2, 50),
    fullName: limitedText("Full name", 2, 50),
    password: limitedText("Password", 6, 50),
    roles: z.array(z.string()).default([]),
});

export const createWCAUserSchema = z.object({
    wcaId: requiredText("Please select a person"),
    roles: z.array(z.string()).default([]),
});

export const editUserSchema = z.object({
    username: limitedText("Username", 2, 50).default("").optional(),
    fullName: limitedText("Full name", 2, 50).default("").optional(),
    roles: z.array(z.string()).default([]),
});

export const editUserPasswordSchema = z.object({
    password: limitedText("Password", 6, 50),
});
