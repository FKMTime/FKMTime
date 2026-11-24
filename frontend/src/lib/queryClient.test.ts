import { describe, expect, it } from "vitest";

import { shouldRetryQuery } from "./queryClient";
import { QueryError } from "./queryError";

describe("shouldRetryQuery", () => {
    it("retries network failures and server errors up to twice", () => {
        for (const error of [
            new TypeError("Failed to fetch"),
            new QueryError(503),
        ]) {
            expect(shouldRetryQuery(0, error)).toBe(true);
            expect(shouldRetryQuery(1, error)).toBe(true);
            expect(shouldRetryQuery(2, error)).toBe(false);
        }
    });

    it("doesn't retry a request the server refused", () => {
        for (const status of [400, 401, 403, 404]) {
            expect(shouldRetryQuery(0, new QueryError(status))).toBe(false);
        }
    });

    it("retries timeouts and rate limits", () => {
        expect(shouldRetryQuery(0, new QueryError(408))).toBe(true);
        expect(shouldRetryQuery(0, new QueryError(429))).toBe(true);
    });
});
