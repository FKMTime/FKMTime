import { describe, expect, it } from "vitest";

import { loginErrorMessage } from "@/lib/auth";

describe("loginErrorMessage", () => {
    it("tells the user their username or password is wrong", () => {
        expect(loginErrorMessage(401, "Wrong credentials!")).toBe(
            "Wrong username or password"
        );
    });

    it("asks the user to wait after too many attempts", () => {
        expect(loginErrorMessage(429, "ThrottlerException")).toBe(
            "Too many sign-in attempts. Wait a minute and try again."
        );
    });

    it("shows the backend's reason for other refusals", () => {
        expect(loginErrorMessage(403, "Already logged in with WCA")).toBe(
            "Already logged in with WCA"
        );
    });

    it("falls back to a generic message", () => {
        expect(loginErrorMessage(500)).toBe("Something went wrong");
    });
});
