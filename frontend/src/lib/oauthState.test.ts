import { beforeEach, describe, expect, it } from "vitest";

import { createOAuthState, takeOAuthState } from "./oauthState";

describe("OAuth state", () => {
    beforeEach(() => sessionStorage.clear());

    it("accepts the value this tab created, once", () => {
        const state = createOAuthState("login");

        expect(state).toMatch(/^[0-9a-f]{32}$/);
        expect(takeOAuthState("login", state)).toBe(true);
        expect(takeOAuthState("login", state)).toBe(false);
    });

    it("refuses a missing or different value", () => {
        createOAuthState("login");
        expect(takeOAuthState("login", null)).toBe(false);

        createOAuthState("login");
        expect(takeOAuthState("login", "someone-elses-state")).toBe(false);
    });

    it("refuses when this tab never started a sign-in", () => {
        expect(takeOAuthState("login", "anything")).toBe(false);
    });

    it("keeps the two flows apart", () => {
        const state = createOAuthState("integrated-live");

        expect(takeOAuthState("login", state)).toBe(false);
        expect(takeOAuthState("integrated-live", state)).toBe(true);
    });
});
