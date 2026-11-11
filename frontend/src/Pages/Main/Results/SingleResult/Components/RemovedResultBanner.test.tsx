import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Result } from "@/lib/interfaces";
import { bringBackResult } from "@/lib/results";

import RemovedResultBanner from "./RemovedResultBanner";

vi.mock("@/lib/results", () => ({ bringBackResult: vi.fn() }));
vi.mock("@/hooks/useToast", () => ({
    useToast: () => ({ toast: vi.fn() }),
}));
// Confirming straight away
vi.mock("@/hooks/useConfirm", () => ({
    useConfirm:
        () =>
        async ({ onConfirm }: { onConfirm: () => Promise<void> }) =>
            onConfirm(),
}));

const removed = (overrides: Partial<Result> = {}) =>
    ({
        id: "result-2",
        roundId: "333-r2",
        removedAt: new Date(2026, 0, 1),
        removedReason: "Score-taking mistake",
        removedByRulingOf: null,
        ...overrides,
    }) as Result;

const renderBanner = (result: Result) => {
    const onBroughtBack = vi.fn();
    render(
        <MemoryRouter>
            <RemovedResultBanner
                result={result}
                onBroughtBack={onBroughtBack}
            />
        </MemoryRouter>
    );
    return onBroughtBack;
};

describe("RemovedResultBanner", () => {
    beforeEach(() => {
        vi.mocked(bringBackResult).mockResolvedValue({ status: 200 });
    });

    it("brings back a result removed on its own", async () => {
        const onBroughtBack = renderBanner(removed());

        expect(screen.getByText(/Score-taking mistake/)).toBeTruthy();
        await userEvent.click(
            screen.getByRole("button", { name: "Bring back" })
        );

        expect(bringBackResult).toHaveBeenCalledWith("result-2");
        await waitFor(() => expect(onBroughtBack).toHaveBeenCalled());
    });

    it("points to the ruling that removed it", () => {
        renderBanner(
            removed({
                removedByRulingOf: { id: "result-1", roundId: "333-r1" },
            })
        );

        expect(screen.getByRole("link").getAttribute("href")).toBe(
            "/results/result-1"
        );
        expect(screen.getByText(/Restoring that ruling/)).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Bring back" })).toBeNull();
    });
});
