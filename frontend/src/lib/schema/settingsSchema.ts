import { z } from "zod";

import { limitedText } from "./fields";

export const settingsSchema = z.object({
    username: limitedText("Username", 2, 50).default(""),
});

export const changePasswordSchema = z.object({
    currentPassword: limitedText("Current password", 6, 50),
    newPassword: limitedText("New password", 6, 50),
    confirmPassword: limitedText("Password confirmation", 6, 50),
});
