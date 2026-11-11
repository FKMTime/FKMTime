import { describe, expect, it } from "vitest";

import { UserInfo, UserRole } from "@/lib/interfaces";

import { getAccountDescription } from "./accountDescription";

const user = (roles: string[], wcaAccessToken?: string) =>
    ({ username: "u", roles, wcaAccessToken }) as unknown as UserInfo;

describe("getAccountDescription", () => {
    it("shows the highest role and the account type", () => {
        expect(getAccountDescription(user(["STAFF", "DELEGATE"]))).toBe(
            "Delegate · FKMTime account"
        );
        expect(getAccountDescription(user([UserRole.ORGANIZER], "token"))).toBe(
            "Organizer · WCA account"
        );
    });

    it("falls back to the account type without a known role", () => {
        expect(getAccountDescription(user([]))).toBe("FKMTime account");
    });
});
