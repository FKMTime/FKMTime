import { act, renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ScrambleSet } from "@/lib/interfaces";

import { useUnlockableScrambleSet } from "./useUnlockableScrambleSet";

const sets: Record<string, ScrambleSet> = {
    "set-a": {
        id: "set-a",
        roundId: "333oh-r2",
        set: "A",
        scramblesCount: 5,
        extraScramblesCount: 2,
    },
    "set-d": {
        id: "set-d",
        roundId: "333oh-r2",
        set: "D",
        scramblesCount: 5,
        extraScramblesCount: 2,
    },
};

const api = vi.hoisted(() => ({
    /** Resolves a pending set fetch */
    resolvers: new Map<string, () => void>(),
    unlockScrambleSet: vi.fn(),
}));
vi.mock("@/lib/scrambling", () => ({
    getScrambleSetById: (id: string) =>
        new Promise((resolve) =>
            api.resolvers.set(id, () => resolve(sets[id]))
        ),
    unlockScrambleSet: api.unlockScrambleSet,
    decryptScrambles: (scrambles: { id: string }[]) =>
        scrambles.map((s) => ({ ...s, scramble: `decrypted ${s.id}` })),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter>{children}</MemoryRouter>
);

describe("useUnlockableScrambleSet", () => {
    it("locks the next set a head-to-head match moves on to, and never shows the previous one", async () => {
        api.unlockScrambleSet.mockResolvedValue({
            status: 200,
            data: { scrambles: [{ id: "a1", num: 1, isExtra: false }] },
        });
        const { result, rerender } = renderHook(
            ({ id }) => useUnlockableScrambleSet(id),
            { wrapper, initialProps: { id: "set-a" } }
        );
        await act(async () => api.resolvers.get("set-a")?.());
        await act(() => result.current.unlock("secret"));
        expect(result.current.scrambles).toHaveLength(1);

        rerender({ id: "set-d" });

        // Set A is still loaded, but it isn't the set in the route
        expect(result.current.scrambleSet).toBeNull();
        expect(result.current.scrambles).toBeNull();
        await act(async () => result.current.unlock("other"));
        expect(api.unlockScrambleSet).toHaveBeenCalledTimes(1);

        await act(async () => api.resolvers.get("set-d")?.());
        await waitFor(() => expect(result.current.scrambleSet?.set).toBe("D"));
        expect(result.current.scrambles).toBeNull();
    });
});
