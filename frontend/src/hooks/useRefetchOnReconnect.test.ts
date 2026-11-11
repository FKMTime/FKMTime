import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { queryClient } from "@/lib/queryClient";
import { QueryWrapper } from "@/test/queryClient";

import { useRefetchOnReconnect } from "./useRefetchOnReconnect";

const managerHandlers = vi.hoisted(() => new Map<string, () => void>());

vi.mock("@/socket", () => ({
    socket: {
        io: {
            on: (event: string, handler: () => void) =>
                managerHandlers.set(event, handler),
            off: (event: string) => managerHandlers.delete(event),
        },
    },
}));

describe("useRefetchOnReconnect", () => {
    afterEach(() => vi.restoreAllMocks());

    it("refetches everything after a reconnect, until unmounted", () => {
        const invalidate = vi.spyOn(queryClient, "invalidateQueries");
        const { unmount } = renderHook(() => useRefetchOnReconnect(), {
            wrapper: QueryWrapper,
        });

        act(() => managerHandlers.get("reconnect")?.());
        expect(invalidate).toHaveBeenCalledTimes(1);

        unmount();
        expect(managerHandlers.has("reconnect")).toBe(false);
    });
});
