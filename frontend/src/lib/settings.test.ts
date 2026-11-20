import { beforeEach, describe, expect, it, vi } from "vitest";

import { getToken } from "./auth";
import { changePassword } from "./settings";

const backendRequest = vi.hoisted(() => vi.fn());

vi.mock("./request", () => ({
    backendRequest,
    backendQuery: vi.fn(),
}));

describe("changePassword", () => {
    beforeEach(() => {
        localStorage.clear();
        localStorage.setItem("fkmtime-token", "old-token");
    });

    it("keeps this session signed in with the fresh token", async () => {
        backendRequest.mockResolvedValue({
            status: 200,
            json: async () => ({ message: "Password changed", token: "new" }),
        });

        expect(await changePassword("old", "new-password")).toBe(200);
        expect(getToken()).toBe("new");
    });

    it("keeps the old token when the change is refused", async () => {
        backendRequest.mockResolvedValue({
            status: 403,
            json: async () => ({ message: "Wrong password" }),
        });

        expect(await changePassword("wrong", "new-password")).toBe(403);
        expect(getToken()).toBe("old-token");
    });
});
