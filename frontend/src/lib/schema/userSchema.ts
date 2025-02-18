import { z } from "zod";

export const createFKMUserSchema = z.object({
    username: z.string().min(2).max(50).default(""),
    fullName: z.string().min(2).max(50).default(""),
    password: z.string().min(6).max(50).default(""),
    roles: z.array(z.string()).default([]),
});

export const createWCAUserSchema = z.object({
    wcaId: z.string().min(2).max(50).default(""),
    roles: z.array(z.string()).default([]),
});

export const editUserSchema = z.object({
    username: z.string().min(2).max(50).default("").optional(),
    fullName: z.string().min(2).max(50).default("").optional(),
    roles: z.array(z.string()).default([]),
});

export const editUserPasswordSchema = z.object({
    password: z.string().min(6).max(50),
});
