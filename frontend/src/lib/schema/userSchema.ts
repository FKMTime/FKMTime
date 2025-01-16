import { z } from "zod";

import { UserRole } from "../interfaces";

export const createFKMUserSchema = z.object({
    username: z.string().min(2).max(50).default(""),
    fullName: z.string().min(2).max(50).default(""),
    password: z.string().min(6).max(50).default(""),
    role: z.enum(["ADMIN", "STAFF"]).default(UserRole.ADMIN),
});

export const createWCAUserSchema = z.object({
    wcaId: z.string().min(2).max(50).default(""),
    role: z.enum(["ADMIN", "STAFF"]).default(UserRole.ADMIN),
});

export const editUserSchema = z.object({
    username: z.string().min(2).max(50).default("").optional(),
    fullName: z.string().min(2).max(50).default("").optional(),
    role: z.enum(["ADMIN", "STAFF"]).default(UserRole.ADMIN),
});

export const editUserPasswordSchema = z.object({
    password: z.string().min(6).max(50),
});
