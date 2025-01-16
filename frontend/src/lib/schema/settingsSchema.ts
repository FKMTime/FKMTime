import { z } from "zod";

export const settingsSchema = z.object({
    username: z.string().min(2).max(50).default(""),
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(6).max(50),
    newPassword: z.string().min(6).max(50),
    confirmPassword: z.string().min(6).max(50),
});
